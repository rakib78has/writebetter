import { DIALECTS, type Dialect } from '../writing/types.ts';

/**
 * The user's preferences. Stored with chrome.storage.local, which stays on
 * this device: chrome.storage.sync would copy it to the user's Google
 * account, and WriteBetter promises that nothing leaves the device.
 *
 * Only preferences are stored here, never text.
 */
export interface Settings {
  dialect: Dialect;
}

/** The slice of chrome.storage.local this module uses, so tests can fake it. */
export interface SettingsStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const KEY = 'settings';

/** Browser language tags that select each English variety. */
const DIALECT_BY_REGION: Readonly<Record<string, Dialect>> = {
  GB: 'british',
  UK: 'british',
  IE: 'british',
  NZ: 'british',
  AU: 'australian',
  CA: 'canadian',
  IN: 'indian',
};

/**
 * Picks the English variety from the browser's languages: the first English
 * one with a known region wins ("en-GB" → British). American is the
 * fallback, since it is Harper's default and the most common.
 */
export function defaultDialect(languages: readonly string[]): Dialect {
  for (const tag of languages) {
    const [language, region] = tag.split('-');
    if (language?.toLowerCase() !== 'en') continue;
    const dialect = region ? DIALECT_BY_REGION[region.toUpperCase()] : undefined;
    return dialect ?? 'american';
  }
  return 'american';
}

/**
 * Reads the stored settings. Anything missing or invalid falls back to the
 * default, so a corrupted or older stored value can never break the popup.
 */
export async function loadSettings(
  storage: SettingsStorage,
  languages: readonly string[]
): Promise<Settings> {
  const fallback: Settings = { dialect: defaultDialect(languages) };
  let stored: unknown;
  try {
    stored = (await storage.get(KEY))[KEY];
  } catch {
    return fallback;
  }
  const dialect = (stored as { dialect?: unknown } | undefined)?.dialect;
  return {
    dialect:
      typeof dialect === 'string' && (DIALECTS as readonly string[]).includes(dialect)
        ? (dialect as Dialect)
        : fallback.dialect,
  };
}

export async function saveSettings(storage: SettingsStorage, settings: Settings): Promise<void> {
  await storage.set({ [KEY]: { dialect: settings.dialect } });
}
