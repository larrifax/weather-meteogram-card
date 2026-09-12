import type { EChartsOption } from "echarts";
import { COL, GRID, type ThemeColors } from "../const";
import { num, type TimedForecast } from "../forecast";
import { xAxis } from "./axis";

export function windOption(
  data: TimedForecast[],
  hours: string[],
  th: ThemeColors,
): EChartsOption {
  const speed = data.map((f) => num(f.wind_speed));
  // Stack trick: base = speed line, delta = gust-speed stacked with areaStyle, so
  // the shaded area fills the speed→gust range.
  const delta = data.map((f) =>
    Math.max(0, num(f.wind_gust_speed ?? f.wind_speed) - num(f.wind_speed)),
  );
  const arrows = data.map((f, i) => ({
    value: [i, 0],
    symbolRotate: num(f.wind_bearing) + 180,
  }));
  return {
    animation: false,
    grid: { left: GRID.left, right: GRID.right, top: 12, bottom: 22 },
    tooltip: {
      trigger: "axis",
      formatter: (p: any) => {
        const s = p.find((x: any) => x.seriesName === "Vind")?.data ?? 0;
        const d = p.find((x: any) => x.seriesName === "Kast")?.data ?? 0;
        return `${p[0].axisValue}:00<br>Vind <b>${Math.round(s)} m/s</b><br>Kast ${Math.round(s + d)} m/s`;
      },
    },
    xAxis: xAxis(hours, true, th),
    yAxis: {
      type: "value",
      min: 0,
      axisLabel: { fontSize: 10, color: th.sec },
      splitLine: { lineStyle: { opacity: 0.15 } },
    },
    series: [
      {
        name: "Vind",
        type: "line",
        data: speed,
        stack: "w",
        symbol: "none",
        lineStyle: { color: COL.wind, width: 1.5 },
        areaStyle: { opacity: 0 },
        z: 3,
        label: {
          show: true,
          position: "top",
          fontSize: 9,
          color: COL.wind,
          formatter: (o: any) => `${Math.round(o.value)}`,
        },
      },
      {
        name: "Kast",
        type: "line",
        data: delta,
        stack: "w",
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { color: COL.wind, opacity: 0.3 },
        z: 2,
      },
      {
        name: "Retning",
        type: "scatter",
        data: arrows,
        symbol: "path://M0,-5 L-3,4 L0,2 L3,4 Z",
        symbolSize: 11,
        symbolOffset: [0, -9],
        itemStyle: { color: th.sec },
        silent: true,
        tooltip: { show: false },
        z: 4,
      },
    ],
  };
}
