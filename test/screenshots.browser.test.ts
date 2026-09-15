import { expect, test, beforeAll, afterAll } from "vitest";
import { page } from "vitest/browser";
// Importing the entry registers <weather-meteogram-card> as a side effect.
import "../src/weather-meteogram-card";
import { EXAMPLE_FORECAST } from "./fixtures/example";

// Stub the HA custom elements the card references (mirrors card.browser.test.ts).
beforeAll(() => {
  for (const tag of ["ha-card", "ha-icon", "ha-icon-button", "ha-form"]) {
    if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
  }
});

// Pin the clock to the fixture's first hour so paginate() selects the captured
// window instead of an empty future slice. Restored after the suite.
const REAL_NOW = Date.now;
const FAKE_NOW = Date.parse("2026-09-15T19:00:00+00:00");
beforeAll(() => {
  Date.now = () => FAKE_NOW;
});
afterAll(() => {
  Date.now = REAL_NOW;
});

const hass = {
  states: { "weather.example": {} },
  config: { latitude: 58.66, longitude: 6.72 },
  connection: {
    subscribeMessage(cb: (e: { forecast: unknown }) => void) {
      setTimeout(() => cb({ forecast: EXAMPLE_FORECAST }), 0);
      return Promise.resolve(() => {});
    },
  },
};

// Mock the Open-Meteo climate fetch so the render path runs offline.
const mockClimateFetch = () => {
  const days = 3650;
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => {
      const time: string[] = [];
      const tmin: number[] = [];
      const tmax: number[] = [];
      const precipitation_sum: number[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(FAKE_NOW - i * 8.64e7);
        time.push(d.toISOString().slice(0, 10));
        tmin.push(2 + 3 * Math.sin(i));
        tmax.push(14 + 3 * Math.sin(i));
        precipitation_sum.push(i % 7 === 0 ? 8 : 0.5);
      }
      return {
        daily: { time, temperature_2m_min: tmin, temperature_2m_max: tmax, precipitation_sum },
      };
    },
  })) as typeof fetch;
};

// HA's default light/dark palettes, applied as the CSS vars the card reads in
// _themeColors() (card.ts). Setting them on the host is exactly how HA themes
// the card at runtime.
const THEMES = {
  light: {
    "--primary-text-color": "#212121",
    "--secondary-text-color": "#727272",
    "--ha-card-background": "#ffffff",
    background: "#f5f5f5",
  },
  dark: {
    "--primary-text-color": "#e1e1e1",
    "--secondary-text-color": "#9b9b9b",
    "--ha-card-background": "#1c1c1c",
    background: "#111111",
  },
} as const;

const mountThemed = async (theme: keyof typeof THEMES) => {
  mockClimateFetch();
  const host = document.createElement("div");
  host.style.cssText = "width:703px;height:320px;padding:8px";
  for (const [k, v] of Object.entries(THEMES[theme])) host.style.setProperty(k, v);
  document.body.appendChild(host);

  const el = document.createElement("weather-meteogram-card") as HTMLElement & {
    setConfig: (c: object) => void;
    hass: unknown;
  };
  el.setConfig({ entity: "weather.example", title: "Example" });
  host.appendChild(el);
  el.hass = hass;
  // Let the async subscribe/climate-fetch/paint chain settle.
  await new Promise((r) => setTimeout(r, 1500));
  return { host, el };
};

for (const theme of ["light", "dark"] as const) {
  test(`renders and screenshots the meteogram in ${theme} mode`, async () => {
    const { host, el } = await mountThemed(theme);

    // Sanity: the chart actually painted before we capture it.
    const svg = el.querySelector(".chart svg");
    expect(svg, "chart svg mounted").toBeTruthy();
    expect(svg!.querySelectorAll("path").length).toBeGreaterThan(15);

    await page.screenshot({ element: host, path: `__screenshots__/meteogram-${theme}.png` });
  });
}
