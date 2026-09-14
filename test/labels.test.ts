import { expect, test, beforeAll } from "vitest";
import type { ECharts } from "echarts";
// Importing the entry registers <weather-meteogram-card> as a side effect.
import "../src/weather-meteogram-card";

// Guards the top-axis hour labels against ECharts auto-dropping every-other-tick
// labels (the "first day only shows 00/06/12/18" regression). The fix pins
// axisLabel.interval to the formatter's every-even-tick cadence; if that pin is
// lost, interval falls back to "auto" and this test fails.

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
    _chart?: ECharts;
  };
  el.setConfig({ entity: "weather.test", title: "Test" });
  host.appendChild(el);
  el.hass = hass;
  await new Promise((r) => setTimeout(r, 1500));
  return el;
};

test("top-axis hour labels stay on an explicit every-even-tick cadence", async () => {
  const card = await mount();
  const chart = card._chart;
  expect(chart, "chart initialized").toBeTruthy();

  const opt = chart!.getOption() as {
    xAxis: { axisLabel: { interval: unknown; formatter: unknown; show?: boolean } }[];
  };
  const label = opt.xAxis[0].axisLabel;

  // The core guard: interval must be an explicit function, not "auto" — "auto" is
  // exactly what lets ECharts drop the intermediate labels.
  expect(typeof label.interval, 'top-axis interval must be a function, not "auto"').toBe(
    "function",
  );

  // Every even tick is labeled and carries text; every odd tick is suppressed.
  // Label cadence and formatter cadence must agree, or blips and labels diverge.
  for (let i = 0; i < 12; i++) {
    const even = i % 2 === 0;
    const shown =
      typeof label.interval === "function"
        ? (label.interval as (i: number, v: string) => boolean)(i, String(i))
        : label.interval;
    const text =
      typeof label.formatter === "function"
        ? (label.formatter as (v: string, i: number) => string)(String(i), i)
        : `${label.formatter}`;
    expect(shown, `tick ${i}: interval should ${even ? "show" : "hide"} the label`).toBe(even);
    expect(text !== "", `tick ${i}: formatter should ${even ? "emit" : "blank"} the label`).toBe(
      even,
    );
  }

  // The wind axis (xAxis[1]) must stay label-free — its hour labels were removed.
  expect(opt.xAxis[1].axisLabel?.show, "wind axis must not render hour labels").toBeFalsy();
});
