import type { EChartsOption } from "echarts";
import { COL, GRID, type ThemeColors } from "../const";
import { num, type TimedForecast } from "../forecast";
import { xAxis } from "./axis";

export function precipOption(
  data: TimedForecast[],
  hours: string[],
  th: ThemeColors,
): EChartsOption {
  const mm = data.map((f) => num(f.precipitation));
  const prob = data.map((f) => num(f.precipitation_probability));
  return {
    animation: false,
    grid: { left: GRID.left, right: GRID.right, top: 16, bottom: 4 },
    tooltip: {
      trigger: "axis",
      formatter: (p: any) => {
        const m = p.find((x: any) => x.seriesName === "Nedbør");
        const pr = p.find((x: any) => x.seriesName === "Sannsynlighet");
        return `${p[0].axisValue}:00<br>Nedbør <b>${(m?.data ?? 0).toFixed(1)} mm</b><br>Sanns. ${pr?.data ?? 0}%`;
      },
    },
    xAxis: xAxis(hours, false, th),
    yAxis: [
      {
        type: "value",
        min: 0,
        name: "mm",
        nameTextStyle: { fontSize: 9, color: th.sec },
        axisLabel: { fontSize: 10, color: th.sec },
        splitLine: { lineStyle: { opacity: 0.15 } },
      },
      { type: "value", min: 0, max: 100, show: false },
    ],
    series: [
      // Faint probability bar behind the solid mm bar (barGap -100% overlays them).
      {
        name: "Sannsynlighet",
        type: "bar",
        yAxisIndex: 1,
        data: prob,
        barWidth: "72%",
        itemStyle: { color: COL.precip, opacity: 0.18 },
        z: 1,
      },
      {
        name: "Nedbør",
        type: "bar",
        yAxisIndex: 0,
        data: mm,
        barWidth: "44%",
        barGap: "-100%",
        itemStyle: { color: COL.precip },
        z: 2,
        label: {
          show: true,
          position: "top",
          fontSize: 9,
          color: COL.precip,
          formatter: (o: any) => (o.value > 0 ? o.value.toFixed(1) : ""),
        },
      },
    ],
  };
}
