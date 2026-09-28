export const HOUR = 3600e3;
export const DAY = 24 * HOUR;
export const PAGES = 4;
export const PER_PAGE = 12;
// Daily view shows up to this many days on one screen (no paging).
export const DAILY_MAX = 7;

export { ICONS } from "./icons";

export const COL = {
  temp: "#f5b942",
  tempWarm: "#ef6b6b",
  tempCold: "#4f9fe8",
  precip: "#4f9fe8",
  wind: "#607d8b",
};
export const GRID = { left: 40, right: 48 };

export interface ThemeColors {
  sec: string;
  pri: string;
  bg: string;
}
