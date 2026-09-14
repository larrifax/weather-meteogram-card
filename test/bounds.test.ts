import { expect, test } from "vitest";
import { computeBounds } from "../src/charts/bounds";
import type { TimedForecast } from "../src/forecast";

const hours = (temps: number[], precip: number[] = [], gust: number[] = []): TimedForecast[] =>
  temps.map((t, i) => ({
    datetime: new Date(Date.now() + i * 3.6e6).toISOString(),
    t: Date.now() + i * 3.6e6,
    temperature: t,
    precipitation: precip[i] ?? 0,
    wind_gust_speed: gust[i] ?? 0,
  })) as TimedForecast[];

test("temperature snaps to 5° steps with 1° padding", () => {
  const b = computeBounds(hours([8.2, 9.1, 12.4]));
  expect(b.tempMin).toBe(5);
  expect(b.tempMax).toBe(15);
});

test("minimum 10° span is enforced even for flat temperatures", () => {
  const b = computeBounds(hours([10, 10, 10]));
  expect(b.tempMax - b.tempMin).toBeGreaterThanOrEqual(10);
});

test("precip floors at 4mm and rounds up to even steps", () => {
  expect(computeBounds(hours([5], [0])).precipMax).toBe(4);
  expect(computeBounds(hours([5], [5])).precipMax).toBe(6);
});

test("wind floors at 10 and rounds up to 5 steps", () => {
  expect(computeBounds(hours([5], [0], [12])).windMax).toBe(15);
  expect(computeBounds(hours([5], [0], [3])).windMax).toBe(10);
});

test("overrides win over computed values", () => {
  const b = computeBounds(hours([8, 12]), { tempMin: -5, tempMax: 30, precipMax: 20 });
  expect(b.tempMin).toBe(-5);
  expect(b.tempMax).toBe(30);
  expect(b.precipMax).toBe(20);
});

test("empty forecast returns safe defaults", () => {
  expect(computeBounds([])).toEqual({ tempMin: 0, tempMax: 10, precipMax: 4, windMax: 10 });
});

test("a climate normal widens the axes beyond a quiet forecast", () => {
  const b = computeBounds(hours([10, 11]), {}, { tempMin: -8, tempMax: 24, precipMax: 15 });
  expect(b.tempMin).toBe(-10);
  expect(b.tempMax).toBe(25);
  expect(b.precipMax).toBe(16);
});

test("a forecast more extreme than the normal is never clipped", () => {
  const b = computeBounds(hours([-15, 30], [40]), {}, { tempMin: 0, tempMax: 20, precipMax: 5 });
  expect(b.tempMin).toBeLessThanOrEqual(-15);
  expect(b.tempMax).toBeGreaterThanOrEqual(30);
  expect(b.precipMax).toBeGreaterThanOrEqual(40);
});

test("explicit overrides still win over the climate normal", () => {
  const b = computeBounds(hours([10]), { tempMin: 3, tempMax: 18 }, { tempMin: -20, tempMax: 40 });
  expect(b.tempMin).toBe(3);
  expect(b.tempMax).toBe(18);
});
