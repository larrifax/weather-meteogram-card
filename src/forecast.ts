import { HOUR, PAGES, PER_PAGE } from "./const";

/** A single hourly forecast entry from weather.get_forecasts. */
export interface ForecastHour {
  datetime: string;
  condition?: string;
  temperature?: number;
  precipitation?: number;
  precipitation_probability?: number;
  wind_speed?: number;
  wind_gust_speed?: number;
  wind_bearing?: number;
}

/** Forecast entry with a parsed epoch timestamp. */
export type TimedForecast = ForecastHour & { t: number };

export const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Split a full forecast into up-to-PAGES pages of PER_PAGE hourly points from now. */
export function paginate(
  forecast: ForecastHour[],
  now: number,
): TimedForecast[][] {
  const start = Math.floor(now / HOUR) * HOUR;
  const upcoming = forecast
    .map((f) => ({ ...f, t: Date.parse(f.datetime) }))
    .filter((f) => f.t >= start)
    .sort((a, b) => a.t - b.t)
    .slice(0, PAGES * PER_PAGE);
  const pages: TimedForecast[][] = [];
  for (let p = 0; p < PAGES && p * PER_PAGE < upcoming.length; p++)
    pages.push(upcoming.slice(p * PER_PAGE, (p + 1) * PER_PAGE));
  return pages;
}
