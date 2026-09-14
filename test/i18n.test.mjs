// Runnable check for the t() locale fallback chain. Run: node test/i18n.test.mjs
import assert from "node:assert";
import { t } from "../src/i18n.ts";

// Exact language match.
assert.equal(t("nb", "card_default_title"), "Vær", "nb resolves");
assert.equal(t("en", "card_default_title"), "Weather", "en resolves");

// Region subtag strips to primary: "nb-NO" -> "nb", "en-GB" -> "en".
assert.equal(t("nb-NO", "card_default_title"), "Vær", "nb-NO -> nb");
assert.equal(t("en-GB", "card_default_title"), "Weather", "en-GB -> en");

// Unknown language falls back to English (not Norwegian).
assert.equal(t("de", "card_default_title"), "Weather", "de -> en fallback");
assert.equal(t(undefined, "card_default_title"), "Weather", "undefined -> en");

// Case-insensitive.
assert.equal(t("NB", "card_default_title"), "Vær", "uppercase NB");

console.log("i18n.test.mjs OK");
