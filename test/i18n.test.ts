import { expect, test } from "vitest";
import { t } from "../src/i18n";

test("exact language match resolves", () => {
  expect(t("nb", "card_default_title")).toBe("Vær");
  expect(t("en", "card_default_title")).toBe("Weather");
});

test("region subtag strips to primary", () => {
  expect(t("nb-NO", "card_default_title")).toBe("Vær");
  expect(t("en-GB", "card_default_title")).toBe("Weather");
});

test("unknown or missing language falls back to English", () => {
  expect(t("de", "card_default_title")).toBe("Weather");
  expect(t(undefined, "card_default_title")).toBe("Weather");
});

test("language matching is case-insensitive", () => {
  expect(t("NB", "card_default_title")).toBe("Vær");
});
