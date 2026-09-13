import type { EChartsOption } from "echarts";
import { COL, GRID, type ThemeColors } from "../const";
import { num, type TimedForecast } from "../forecast";
import type { AxisBounds } from "./bounds";

// Two stacked grids in ONE chart instance: temperature + precipitation share
// the top grid (temp on the left y-axis, precip mm on the right), wind sits in
// the bottom grid. axisPointer.link keeps the crosshair synced across both, and
// a single instance means a single tooltip.
const GRIDS = [
  { top: "12%", height: "50%" }, // temp + precip (top margin leaves room for the hour labels)
  { top: "72%", height: "16%" }, // wind
].map((g) => ({ left: GRID.left, right: GRID.right, ...g }));

function xAxis(
  hours: string[],
  gridIndex: number,
  showLabels: boolean,
  th: ThemeColors,
  position?: "top" | "bottom",
) {
  return {
    type: "category" as const,
    gridIndex,
    data: hours,
    boundaryGap: true,
    ...(position ? { position } : {}),
    axisLine: { show: false },
    axisTick: { show: showLabels, alignWithLabel: true },
    axisLabel: { show: showLabels, fontSize: 10, color: th.sec },
  };
}

const faintSplit = { lineStyle: { opacity: 0.15 } };

/** Combined tooltip: one box with temp, precipitation and wind for the hovered hour. */
function tooltipFormatter(data: TimedForecast[]) {
  return (params: any): string => {
    const i = Array.isArray(params) ? params[0]?.dataIndex : params?.dataIndex;
    const f = i != null ? data[i] : undefined;
    if (!f) return "";
    const hh = String(new Date(f.t).getHours()).padStart(2, "0");
    const mm = num(f.precipitation);
    const prob = num(f.precipitation_probability);
    const spd = Math.round(num(f.wind_speed));
    const gust = Math.round(num(f.wind_gust_speed ?? f.wind_speed));
    return (
      `${hh}:00` +
      `<br>Temp <b>${Math.round(num(f.temperature))}°</b>` +
      `<br>Nedbør <b>${mm.toFixed(1)} mm</b> (${prob}%)` +
      `<br>Vind <b>${spd} m/s</b> (kast ${gust})`
    );
  };
}

export function meteogramOption(
  data: TimedForecast[],
  hours: string[],
  th: ThemeColors,
  bounds: AxisBounds,
): EChartsOption {
  const temps = data.map((f) => num(f.temperature));
  const mm = data.map((f) => num(f.precipitation));
  const prob = data.map((f) => num(f.precipitation_probability));
  const speed = data.map((f) => num(f.wind_speed));
  // Stack trick: base = speed line, delta = gust-speed stacked with areaStyle, so
  // the shaded area fills the speed→gust range.
  const delta = data.map((f) =>
    Math.max(0, num(f.wind_gust_speed ?? f.wind_speed) - num(f.wind_speed)),
  );
  const arrows = data.map((f, i) => ({ value: [i, 0], symbolRotate: num(f.wind_bearing) + 180 }));
  // Condition icons are NOT an ECharts symbol series: image:// symbols rasterize
  // to a static <image>, killing the SVGs' built-in SMIL animation. The card
  // overlays real <img> elements over the chart instead (see card.ts).

  return {
    animation: false,
    grid: GRIDS,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", link: [{ xAxisIndex: "all" }] },
      formatter: tooltipFormatter(data),
    },
    // Color the temp line by value: red above 4°C, blue at/below. Piecewise
    // visualMap paints each line segment from its y-value; seriesIndex 0 = temp.
    visualMap: {
      show: false,
      type: "piecewise",
      seriesIndex: 0,
      dimension: 1,
      pieces: [
        { gt: 4, color: COL.tempWarm },
        { lte: 4, color: COL.tempCold },
      ],
    },
    // Index 2: hidden twin of axis 0 (same top grid) for the probability bar.
    // Two differently-sized bars on one category axis get edge-aligned by barGap,
    // pushing the narrow mm bar off the band center vs the line points. A solo bar
    // per axis centers on its band, so mm bar, prob bar and line all line up.
    xAxis: [
      xAxis(hours, 0, true, th, "top"),
      xAxis(hours, 1, true, th),
      xAxis(hours, 0, false, th),
    ],
    yAxis: [
      // 0 — temperature (top grid, left axis). Fixed bounds so the scale holds
      // steady across periods instead of refitting each page.
      {
        gridIndex: 0,
        type: "value",
        min: bounds.tempMin,
        max: bounds.tempMax,
        position: "left",
        axisLabel: { formatter: "{value}°", fontSize: 10, color: th.sec },
        splitLine: faintSplit,
      },
      // 1 — precipitation mm (top grid, right axis)
      {
        gridIndex: 0,
        type: "value",
        min: 0,
        max: bounds.precipMax,
        position: "right",
        axisLabel: { formatter: "{value} mm", fontSize: 10, color: th.sec },
        splitLine: { show: false },
      },
      // 2 — precipitation probability (top grid, hidden 0–100 scale behind the bars)
      { gridIndex: 0, type: "value", min: 0, max: 100, show: false },
      // 3 — wind (bottom grid)
      {
        gridIndex: 1,
        type: "value",
        min: 0,
        max: bounds.windMax,
        axisLabel: { fontSize: 10, color: th.sec },
        splitLine: faintSplit,
      },
    ],
    series: [
      {
        name: "Temp",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: temps,
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: COL.temp, width: 2 },
        itemStyle: { color: COL.temp },
        z: 3,
        label: {
          show: true,
          formatter: (o: any) => `${Math.round(o.value)}°`,
          fontSize: 10,
          color: th.pri,
          position: "top",
        },
      },
      // Faint probability bar behind the solid mm bar. Own x-axis (2) so it's the
      // sole bar on that axis and centers on the band; the mm bar does the same on
      // axis 0, so the two overlay dead-center under the line points.
      {
        name: "Sannsynlighet",
        type: "bar",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: prob,
        barWidth: "72%",
        itemStyle: { color: COL.precip, opacity: 0.18 },
        z: 1,
      },
      {
        name: "Nedbør",
        type: "bar",
        xAxisIndex: 0,
        yAxisIndex: 1,
        data: mm,
        barWidth: "44%",
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
      {
        name: "Vind",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 3,
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
        xAxisIndex: 1,
        yAxisIndex: 3,
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
        xAxisIndex: 1,
        yAxisIndex: 3,
        data: arrows,
        symbol: "path://M0,-5 L-3,4 L0,2 L3,4 Z",
        symbolSize: 11,
        symbolOffset: [0, -9],
        itemStyle: { color: th.sec },
        silent: true,
        z: 4,
      },
    ],
  };
}
