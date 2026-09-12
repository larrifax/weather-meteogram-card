import type { EChartsOption } from "echarts";
import { COL, GRID, type ThemeColors } from "../const";
import { num, type TimedForecast } from "../forecast";
import { xAxis } from "./axis";

export function tempOption(
  data: TimedForecast[],
  hours: string[],
  th: ThemeColors,
): EChartsOption {
  const temps = data.map((f) => num(f.temperature));
  return {
    animation: false,
    grid: { left: GRID.left, right: GRID.right, top: 22, bottom: 4 },
    tooltip: {
      trigger: "axis",
      formatter: (p: any) =>
        `${p[0].axisValue}:00<br>Temp <b>${p[0].data}°</b>`,
    },
    xAxis: xAxis(hours, false, th),
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { formatter: "{value}°", fontSize: 10, color: th.sec },
      splitLine: { lineStyle: { opacity: 0.15 } },
    },
    series: [
      {
        type: "line",
        data: temps,
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: COL.temp, width: 2 },
        itemStyle: { color: COL.temp },
        label: {
          show: true,
          formatter: (o: any) => `${Math.round(o.value)}°`,
          fontSize: 10,
          color: th.pri,
          position: "top",
        },
      },
    ],
  };
}
