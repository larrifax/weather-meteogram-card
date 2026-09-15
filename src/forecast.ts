import { DAILY_MAX, DAY, HOUR, PAGES, PER_PAGE } from "./const";

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

/** A single daily forecast entry. Like an hour but temperature is the day HIGH
 *  and templow the day LOW; there is one entry per day. */
export interface ForecastDay extends ForecastHour {
  templow?: number;
}

/** Forecast entry with a parsed epoch timestamp. */
export type TimedForecast = ForecastHour & { t: number };
export type TimedDay = ForecastDay & { t: number };

export const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Split a full forecast into up-to-PAGES pages of PER_PAGE hourly points from now. */
export function paginate(forecast: ForecastHour[], now: number): TimedForecast[][] {
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

/** Upcoming daily entries from the start of today, capped at DAILY_MAX. Daily
 *  view shows them all on one screen, so there is no paging. */
export function upcomingDays(forecast: ForecastDay[], now: number): TimedDay[] {
  const start = Math.floor(now / DAY) * DAY;
  return forecast
    .map((f) => ({ ...f, t: Date.parse(f.datetime) }))
    .filter((f) => f.t >= start)
    .sort((a, b) => a.t - b.t)
    .slice(0, DAILY_MAX);
}
