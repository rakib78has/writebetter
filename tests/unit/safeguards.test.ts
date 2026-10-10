import { describe, expect, it } from 'vitest';
import { applySafeguards, findProtectedRanges } from '../../src/writing/safeguards.ts';
import type { Issue, IssueCategory } from '../../src/writing/types.ts';

function issueIn(text: string, original: string, category: IssueCategory = 'spelling'): Issue {
  const start = text.indexOf(original);
  return {
    start,
    end: start + original.length,
    original,
    category,
    message: 'test',
    replacements: ['x'],
    autoFix: true,
  };
}

const protectedTexts = (text: string) =>
  findProtectedRanges(text).map(({ start, end }) => text.slice(start, end).trim());

describe('findProtectedRanges', () => {
  // WB-UNIT-028
  it.each([
    ['a URL', 'see https://example.com/a-b?c=1 now', 'https://example.com/a-b?c=1'],
    ['a www address', 'visit www.example.org today', 'www.example.org'],
    ['an email address', 'mail ada.l@example.co.uk please', 'ada.l@example.co.uk'],
    ['a mention', 'ask @rakib78has first', '@rakib78has'],
    ['a hashtag', 'tag it #release', '#release'],
    ['inline code', 'run `npm ci` again', '`npm ci`'],
    ['an HTML tag', 'paste <img src=x onerror=alert(1)> here', '<img src=x onerror=alert(1)>'],
    ['a closing tag', 'end </div> here', '</div>'],
    ['an identifier', 'set MAX_INPUT_CHARACTERS now', 'MAX_INPUT_CHARACTERS'],
    ['a path', 'open src/popup/App.tsx', 'src/popup/App.tsx'],
    ['a file name', 'edit constants.ts first', 'constants.ts'],
  ])('protects %s', (_label, text, expected) => {
    expect(protectedTexts(text)).toContain(expected);
  });

  // WB-UNIT-029
  it('does not protect ordinary prose, numbers or sentence ends', () => {
    expect(findProtectedRanges('I paid 3.50 for it. Then I left, and 5 < 6 > 4.')).toEqual([]);
  });
});

describe('applySafeguards', () => {
  // WB-UNIT-030
  it('drops issues that touch protected text', () => {
    const text = 'Open constants.ts and teh file';
    const inFileName = issueIn(text, 'ts', 'capitalization');
    const typo = issueIn(text, 'teh');

    expect(applySafeguards(text, [inFileName, typo])).toEqual([typo]);
  });

  // WB-UNIT-031
  it('never auto-fixes the spelling of a capitalised word, but still reports it', () => {
    const text = 'Rakib met NASA staff';
    const result = applySafeguards(text, [issueIn(text, 'Rakib'), issueIn(text, 'NASA')]);

    expect(result.map((issue) => [issue.original, issue.autoFix])).toEqual([
      ['Rakib', false],
      ['NASA', false],
    ]);
  });

  // WB-UNIT-032
  it('still auto-fixes lowercase spelling and capitalised grammar issues', () => {
    const text = 'Their going to teh park';
    const result = applySafeguards(text, [issueIn(text, 'Their', 'grammar'), issueIn(text, 'teh')]);

    expect(result.every((issue) => issue.autoFix)).toBe(true);
  });

  // WB-UNIT-050
  it('never auto-capitalises the first word, which may start a fragment', () => {
    const text = '  their is a problem';
    const first = issueIn(text, 'their', 'capitalization');
    const [result] = applySafeguards(text, [first]);
    expect(result?.autoFix).toBe(false);
  });

  // WB-UNIT-051
  it('still capitalises a lone "i" at the start, and capitals later in the text', () => {
    const text = 'i went on monday';
    const result = applySafeguards(text, [
      issueIn(text, 'i', 'capitalization'),
      issueIn(text, 'monday', 'capitalization'),
    ]);
    expect(result.every((issue) => issue.autoFix)).toBe(true);
  });

  // WB-UNIT-033
  it('does not modify the issues it was given', () => {
    const text = 'Rakib';
    const issue = issueIn(text, 'Rakib');
    applySafeguards(text, [issue]);
    expect(issue.autoFix).toBe(true);
  });
});
