import { expect, test, beforeAll } from "vitest";
// Importing the entry registers <weather-meteogram-card> as a side effect.
import "../src/weather-meteogram-card";

// Stub the HA custom elements the card references so they don't upgrade to
// nothing and throw. Mirrors the old harness.html.
beforeAll(() => {
  for (const tag of ["ha-card", "ha-icon", "ha-icon-button", "ha-form"]) {
    if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
  }
});

const now = Date.now();
const forecast = Array.from({ length: 48 }, (_, i) => ({
  datetime: new Date(Math.floor(now / 3.6e6) * 3.6e6 + i * 3.6e6).toISOString(),
  condition: ["cloudy", "partlycloudy", "rainy", "sunny"][i % 4],
  temperature: 8 + 5 * Math.sin(i / 4),
  precipitation: i % 5 === 0 ? 1.2 : 0,
  precipitation_probability: (i * 7) % 100,
  wind_speed: 3 + 2 * Math.sin(i / 3),
  wind_gust_speed: 5 + 3 * Math.sin(i / 3),
  wind_bearing: (i * 30) % 360,
}));

const hass = {
  states: { "weather.test": {} },
  config: { latitude: 59.02, longitude: 6.66 },
  connection: {
    subscribeMessage(cb: (e: { forecast: unknown }) => void) {
      setTimeout(() => cb({ forecast }), 0);
      return Promise.resolve(() => {});
    },
  },
};

// Mock the Open-Meteo archive fetch so the climate path runs offline.
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
        const d = new Date(Date.now() - i * 8.64e7);
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

const mount = async () => {
  mockClimateFetch();
  const host = document.createElement("div");
  host.style.cssText = "width:703px;height:320px";
  document.body.appendChild(host);
  const el = document.createElement("weather-meteogram-card") as HTMLElement & {
    setConfig: (c: object) => void;
    hass: unknown;
  };
  el.setConfig({ entity: "weather.test", title: "Test" });
  host.appendChild(el);
  el.hass = hass;
  // Let the async ensure()/subscribe/climate-fetch chain settle and paint.
  await new Promise((r) => setTimeout(r, 1500));
  return el;
};

test("card mounts and renders the ECharts meteogram", async () => {
  const card = await mount();
  const svg = card.querySelector(".chart svg");

  expect(svg, "chart svg mounted").toBeTruthy();
  expect(svg!.querySelectorAll("path").length).toBeGreaterThan(15);
  expect(svg!.querySelectorAll("text").length).toBeGreaterThan(10);
  // Meteocons are overlaid as animated <img> elements, one per hour.
  expect(card.querySelector(".icons")!.querySelectorAll("img").length).toBe(12);
  expect(card.querySelector('[style*="error"]')).toBeNull();
});

test("visualMap colors the temp line by value (gradient endpoints present)", async () => {
  // Guards VisualMapComponent registration in echarts.ts: without it the
  // visualMap option is silently ignored and the line falls back to a flat
  // stroke. Harness temps span ~3–13°, crossing the 1–7° band, so both the
  // warm (#e34a4a) and cold (#4a90d9) gradient stops must appear.
  const card = await mount();
  const svg = card.querySelector(".chart svg")!;
  const stops = [...svg.querySelectorAll("linearGradient stop")].map((s) =>
    s.getAttribute("stop-color"),
  );
  expect(stops).toContain("rgb(227,74,74)");
  expect(stops).toContain("rgb(74,144,217)");
});

test("a single shared tooltip renders on hover", async () => {
  // One shared tooltip is the whole point of the single-instance refactor.
  const card = await mount();
  const chart = card.querySelector(".chart") as HTMLElement;
  const box = chart.getBoundingClientRect();

  const move = new MouseEvent("mousemove", {
    bubbles: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });
  chart.querySelector("svg")?.dispatchEvent(move);
  await new Promise((r) => setTimeout(r, 300));

  const tips = [...card.querySelectorAll("div")].filter(
    (d) =>
      /position:\s*absolute/.test(d.getAttribute("style") || "") && /:00/.test(d.textContent || ""),
  );
  expect(tips.length).toBe(1);
});
