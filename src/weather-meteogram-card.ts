import { WeatherMeteogramCard } from "./cards/weather-meteogram/card";
import { CARD_NAME } from "./cards/weather-meteogram/const";
import { registerCustomCard } from "./utils/register-card";

customElements.define(CARD_NAME, WeatherMeteogramCard);

registerCustomCard({
  type: CARD_NAME,
  name: "Weather Meteogram Card",
  description: "Hourly meteogram (icons + ECharts temp/precip/wind) with 12h paging.",
});

console.info("%c WEATHER-METEOGRAM-CARD ", "color: white; background: #4a90d9; font-weight: 700;");
