import { describe, expect, it, vi } from 'vitest';
import {
  defaultDialect,
  loadSettings,
  saveSettings,
  type SettingsStorage,
} from '../../src/settings/settings.ts';

function fakeStorage(stored: Record<string, unknown> = {}) {
  const data = { ...stored };
  return {
    data,
    get: vi.fn((key: string) => Promise.resolve(key in data ? { [key]: data[key] } : {})),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(data, items);
      return Promise.resolve();
    }),
  } satisfies SettingsStorage & { data: Record<string, unknown> };
}

describe('defaultDialect', () => {
  // WB-UNIT-053
  it.each([
    [['en-GB'], 'british'],
    [['en-gb'], 'british'],
    [['en-IE'], 'british'],
    [['en-NZ'], 'british'],
    [['en-AU'], 'australian'],
    [['en-CA'], 'canadian'],
    [['en-IN'], 'indian'],
    [['en-US'], 'american'],
    [['en'], 'american'],
    [['bn-BD', 'en-GB'], 'british'],
    [['fr-CA', 'en-US'], 'american'],
    [['de-DE'], 'american'],
    [[], 'american'],
  ])('picks a variety from %j', (languages, expected) => {
    expect(defaultDialect(languages)).toBe(expected);
  });
});

describe('loadSettings', () => {
  // WB-UNIT-054
  it('returns the stored dialect', async () => {
    const storage = fakeStorage({ settings: { dialect: 'canadian' } });
    await expect(loadSettings(storage, ['en-US'])).resolves.toEqual({ dialect: 'canadian' });
  });

  // WB-UNIT-055
  it('falls back to the browser language when nothing is stored', async () => {
    await expect(loadSettings(fakeStorage(), ['en-AU'])).resolves.toEqual({
      dialect: 'australian',
    });
  });

  // WB-SEC-032
  it.each([
    ['an unknown dialect', { settings: { dialect: 'klingon' } }],
    ['a non-string dialect', { settings: { dialect: 7 } }],
    ['a non-object value', { settings: 'british' }],
    ['null', { settings: null }],
  ])('ignores %s in storage', async (_label, stored) => {
    await expect(loadSettings(fakeStorage(stored), ['en-GB'])).resolves.toEqual({
      dialect: 'british',
    });
  });

  // WB-UNIT-056
  it('falls back to the default when storage fails', async () => {
    const storage = fakeStorage();
    storage.get.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(loadSettings(storage, ['en-IN'])).resolves.toEqual({ dialect: 'indian' });
  });
});

describe('saveSettings', () => {
  // WB-UNIT-057
  it('stores only the known setting under one key', async () => {
    const storage = fakeStorage();
    await saveSettings(storage, { dialect: 'british', extra: 'dropped' } as never);
    expect(storage.data).toEqual({ settings: { dialect: 'british' } });
  });
});
