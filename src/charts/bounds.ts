import type { TimedForecast } from "../forecast";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

export interface AxisBounds {
  tempMin: number;
  tempMax: number;
  precipMax: number;
  windMax: number;
}

export interface BoundsOverrides {
  tempMin?: number;
  tempMax?: number;
  precipMax?: number;
}

// Seasonal climate normals for the current month, used to widen the axes so a
// quiet forecast still shows the range typical for the location and season.
export interface ClimateNormal {
  tempMin: number;
  tempMax: number;
  precipMax: number;
}

const TEMP_STEP = 5;
const TEMP_PAD = 1;
const TEMP_MIN_SPAN = 10;
const PRECIP_STEP = 2;
const PRECIP_FLOOR = 4;
const WIND_STEP = 5;
const WIND_FLOOR = 10;

// Snap axis bounds to round steps over the WHOLE forecast (not the current page),
// so the scales stay stable from period to period and only move when the data
// crosses a step boundary. Because the input is the location's own forecast, the
// bounds already reflect the local season; explicit overrides pin them further.
export function computeBounds(
  all: TimedForecast[],
  o: BoundsOverrides = {},
  climate?: ClimateNormal,
): AxisBounds {
  if (!all.length) {
    return { tempMin: 0, tempMax: TEMP_MIN_SPAN, precipMax: PRECIP_FLOOR, windMax: WIND_FLOOR };
  }
  const temps = all.map((f) => num(f.temperature));
  const precip = all.map((f) => num(f.precipitation));
  const gusts = all.map((f) => num(f.wind_gust_speed ?? f.wind_speed));

  // Widen the raw range with the seasonal normal (never clip the forecast), then
  // quantize; the normal keeps the scale representative when a period is quiet.
  const rawMin = Math.min(...temps, climate?.tempMin ?? Infinity);
  const rawMax = Math.max(...temps, climate?.tempMax ?? -Infinity);
  let tMin = Math.floor((rawMin - TEMP_PAD) / TEMP_STEP) * TEMP_STEP;
  let tMax = Math.ceil((rawMax + TEMP_PAD) / TEMP_STEP) * TEMP_STEP;
  while (tMax - tMin < TEMP_MIN_SPAN) {
    tMin -= TEMP_STEP;
    tMax += TEMP_STEP;
  }

  const rawPrecip = Math.max(...precip, climate?.precipMax ?? 0);
  const precipMax = Math.max(PRECIP_FLOOR, Math.ceil(rawPrecip / PRECIP_STEP) * PRECIP_STEP);
  const windMax = Math.max(WIND_FLOOR, Math.ceil(Math.max(...gusts) / WIND_STEP) * WIND_STEP);

  return {
    tempMin: o.tempMin ?? tMin,
    tempMax: o.tempMax ?? tMax,
    precipMax: o.precipMax ?? precipMax,
    windMax,
  };
}
