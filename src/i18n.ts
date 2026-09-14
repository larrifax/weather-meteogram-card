import en from "./locales/en.json" with { type: "json" };
import nb from "./locales/nb.json" with { type: "json" };

// Bundled, statically imported so the single-file HACS build inlines them — no
// runtime fetch. English is the base/fallback; add a locale by importing its
// JSON and adding it here.
export type TranslationKey = keyof typeof en;
const LOCALES: Record<string, Partial<Record<TranslationKey, string>>> = { en, nb };

/**
 * Translate `key` for the given hass language. `lang` is HA's `hass.language`
 * (e.g. "nb", "en-GB"); we match on the primary subtag and fall back to English,
 * then to the key itself so a missing string is visible rather than blank.
 */
export function t(lang: string | undefined, key: TranslationKey): string {
  const primary = (lang ?? "en").toLowerCase().split("-")[0];
  return LOCALES[primary]?.[key] ?? en[key] ?? key;
}
