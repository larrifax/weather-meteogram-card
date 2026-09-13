import type { ClimateNormal } from "./bounds";

// Seasonal climate normals from Open-Meteo's free archive API (no key, CORS-open).
// We pull ~10 years of daily data, keep the current calendar month, and take
// robust percentiles so a single freak day doesn't set the axis.

const YEARS = 10;
const CACHE_PREFIX = "wm-climate:";
const CACHE_TTL = 30 * 24 * 3600e3; // a month; normals barely move

interface Cached {
  ts: number;
  normal: ClimateNormal;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

function cacheKey(lat: number, lon: number, month: number): string {
  return `${CACHE_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)},${month}`;
}

function readCache(key: string): ClimateNormal | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const c = JSON.parse(raw) as Cached;
    if (Date.now() - c.ts > CACHE_TTL) return undefined;
    return c.normal;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, normal: ClimateNormal): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), normal } satisfies Cached));
  } catch {
    // localStorage unavailable/full — a cache miss just means we refetch.
  }
}

/**
 * Fetch seasonal normals for the current month at (lat, lon). Returns undefined
 * on any failure so the caller falls back to forecast-only bounds.
 */
export async function fetchClimateNormal(
  lat: number,
  lon: number,
): Promise<ClimateNormal | undefined> {
  const month = new Date().getMonth() + 1;
  const key = cacheKey(lat, lon, month);
  const cached = readCache(key);
  if (cached) return cached;

  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - YEARS);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${iso(start)}&end_date=${iso(end)}` +
    `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&timezone=UTC`;

  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const j = await res.json();
    const time: string[] = j?.daily?.time ?? [];
    const tmin: number[] = j?.daily?.temperature_2m_min ?? [];
    const tmax: number[] = j?.daily?.temperature_2m_max ?? [];
    const psum: number[] = j?.daily?.precipitation_sum ?? [];

    const mm = `-${String(month).padStart(2, "0")}-`;
    const lows: number[] = [];
    const highs: number[] = [];
    const precs: number[] = [];
    for (let i = 0; i < time.length; i++) {
      if (!time[i].includes(mm)) continue;
      if (typeof tmin[i] === "number") lows.push(tmin[i]);
      if (typeof tmax[i] === "number") highs.push(tmax[i]);
      if (typeof psum[i] === "number") precs.push(psum[i]);
    }
    if (!lows.length || !highs.length) return undefined;

    lows.sort((a, b) => a - b);
    highs.sort((a, b) => a - b);
    precs.sort((a, b) => a - b);
    // 5th/95th percentiles for temperature, 90th for daily precipitation.
    const normal: ClimateNormal = {
      tempMin: percentile(lows, 5),
      tempMax: percentile(highs, 95),
      precipMax: percentile(precs, 90),
    };
    writeCache(key, normal);
    return normal;
  } catch {
    return undefined;
  }
}
