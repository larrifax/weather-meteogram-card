export const HOUR = 3600e3;
export const PAGES = 4;
export const PER_PAGE = 12;

/** HA weather condition slug → MDI icon name (ha-icon renders these natively). */
export const ICONS: Record<string, string> = {
  "clear-night": "mdi:weather-night",
  cloudy: "mdi:weather-cloudy",
  fog: "mdi:weather-fog",
  hail: "mdi:weather-hail",
  lightning: "mdi:weather-lightning",
  "lightning-rainy": "mdi:weather-lightning-rainy",
  partlycloudy: "mdi:weather-partly-cloudy",
  pouring: "mdi:weather-pouring",
  rainy: "mdi:weather-rainy",
  snowy: "mdi:weather-snowy",
  "snowy-rainy": "mdi:weather-snowy-rainy",
  sunny: "mdi:weather-sunny",
  windy: "mdi:weather-windy",
  "windy-variant": "mdi:weather-windy-variant",
  exceptional: "mdi:alert-circle-outline",
};

export const COL = { temp: "#e8a33d", precip: "#4a90d9", wind: "#607d8b" };
export const GRID = { left: 40, right: 12 };

export interface ThemeColors {
  sec: string;
  pri: string;
}
