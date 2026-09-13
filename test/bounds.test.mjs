// Runnable check for computeBounds axis rounding. Run: node test/bounds.test.mjs
// (Node strips the TS types natively; bounds.ts has only a type-only import.)
import assert from "node:assert";
import { computeBounds } from "../src/charts/bounds.ts";

const hours = (temps, precip = [], gust = []) =>
  temps.map((t, i) => ({
    datetime: new Date(Date.now() + i * 3.6e6).toISOString(),
    t: Date.now() + i * 3.6e6,
    temperature: t,
    precipitation: precip[i] ?? 0,
    wind_gust_speed: gust[i] ?? 0,
  }));

// Temperature snaps to 5° steps with 1° padding.
let b = computeBounds(hours([8.2, 9.1, 12.4]));
assert.equal(b.tempMin, 5, "tempMin floors to 5");
assert.equal(b.tempMax, 15, "tempMax ceils to 15");

// Minimum 10° span is enforced even for flat temperatures.
b = computeBounds(hours([10, 10, 10]));
assert.ok(b.tempMax - b.tempMin >= 10, "min 10° span");

// Precip floors at 4mm and rounds up to even steps.
b = computeBounds(hours([5], [0]));
assert.equal(b.precipMax, 4, "precipMax floor is 4");
b = computeBounds(hours([5], [5]));
assert.equal(b.precipMax, 6, "precipMax rounds 5 up to 6");

// Wind floors at 10 and rounds up to 5 steps.
b = computeBounds(hours([5], [0], [12]));
assert.equal(b.windMax, 15, "windMax rounds 12 up to 15");
b = computeBounds(hours([5], [0], [3]));
assert.equal(b.windMax, 10, "windMax floor is 10");

// Overrides win over computed values.
b = computeBounds(hours([8, 12]), { tempMin: -5, tempMax: 30, precipMax: 20 });
assert.equal(b.tempMin, -5);
assert.equal(b.tempMax, 30);
assert.equal(b.precipMax, 20);

// Empty forecast returns safe defaults.
b = computeBounds([]);
assert.deepEqual(b, { tempMin: 0, tempMax: 10, precipMax: 4, windMax: 10 });

console.log("bounds.test.mjs: PASS");
