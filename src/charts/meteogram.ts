import type { EChartsOption } from "echarts";
import { COL, GRID, type ThemeColors } from "../const";
import { num, type TimedForecast } from "../forecast";
import { t } from "../i18n";
import type { AxisBounds } from "./bounds";

// Two stacked grids in ONE chart instance: temperature + precipitation share
// the top grid (temp on the left y-axis, precip mm on the right), wind sits in
// the bottom grid. axisPointer.link keeps the crosshair synced across both, and
// a single instance means a single tooltip.
const GRIDS = [
  { top: "12%", height: "50%" }, // temp + precip (top margin leaves room for the hour labels)
  { top: "72%", height: "16%" }, // wind
].map((g) => ({ left: GRID.left, right: GRID.right, ...g }));

const dateFmt = (lang?: string) =>
  new Intl.DateTimeFormat(lang || "en", { weekday: "short", day: "numeric" });
// Tooltip heading: weekday + day + month, e.g. "Sat, 14 Sep".
const tipDateFmt = (lang?: string) =>
  new Intl.DateTimeFormat(lang || "en", { weekday: "short", day: "numeric", month: "short" });

function xAxis(
  hours: string[],
  gridIndex: number,
  showLabels: boolean,
  th: ThemeColors,
  position?: "top" | "bottom",
  // When given (top axis), stamp the date above the hour at each day boundary.
  times?: number[],
  lang?: string,
) {
  const DATE_FMT = dateFmt(lang);
  const dateLabel =
    times &&
    ((_v: string, i: number): string => {
      // Label every other tick; odd ticks keep their blip but show no text.
      if (i % 2 !== 0) return "";
      const d = new Date(times[i]);
      const boundary = i === 0 || d.getDate() !== new Date(times[i - 1]).getDate();
      const hh = String(d.getHours()).padStart(2, "0");
      return boundary ? `{d|${DATE_FMT.format(d)}}\n${hh}` : hh;
    });
  return {
    type: "category" as const,
    gridIndex,
    data: hours,
    boundaryGap: true,
    ...(position ? { position } : {}),
    // onZero:false pins the axis (and its ticks) to the grid edge; without it the
    // ticks anchor at the value-axis zero line, dropping to the chart bottom.
    axisLine: { show: false, onZero: false },
    // interval:0 forces a tick at every hour; the default "auto" drops ticks whose
    // label is blank (odd hours), leaving a blip only every other tick.
    axisTick: { show: showLabels, alignWithLabel: true, interval: 0 },
    axisLabel: {
      show: showLabels,
      // Force every-other-tick labels to match the formatter. Default "auto"
      // auto-drops labels it deems overlapping; the wider two-line date label on
      // day one skews that calc so only 00/06/12/18 survive on the first day.
      interval: (i: number) => i % 2 === 0,
      fontSize: 10,
      color: th.sec,
      ...(dateLabel
        ? {
            formatter: dateLabel,
            rich: {
              d: {
                fontSize: 10,
                fontWeight: "bold" as const,
                color: th.sec,
                padding: [0, 0, 3, 0],
              },
            },
          }
        : {}),
    },
  };
}

const faintSplit = { lineStyle: { opacity: 0.15 } };

/** Combined tooltip: one box with temp, precipitation and wind for the hovered hour. */
function tooltipFormatter(data: TimedForecast[], lang?: string) {
  const heading = tipDateFmt(lang);
  // Value colored to match its graph: temp warm/cold by band (crossover 4°,
  // matching the visualMap 1–7° center), precipitation the precip blue, wind
  // the wind color. Grid: label left, value right-aligned.
  const row = (label: string, value: string, color: string) =>
    `<span style="opacity:.7">${label}</span>` +
    `<span style="text-align:right;font-weight:600;color:${color}">${value}</span>`;
  return (params: any): string => {
    const i = Array.isArray(params) ? params[0]?.dataIndex : params?.dataIndex;
    const f = i != null ? data[i] : undefined;
    if (!f) return "";
    const d = new Date(f.t);
    const hh = String(d.getHours()).padStart(2, "0");
    const temp = Math.round(num(f.temperature));
    const tempCol = num(f.temperature) >= 4 ? COL.tempWarm : COL.tempCold;
    const mm = num(f.precipitation);
    const prob = num(f.precipitation_probability);
    const spd = Math.round(num(f.wind_speed));
    const gust = Math.round(num(f.wind_gust_speed ?? f.wind_speed));
    return (
      `<div style="font-weight:700;font-size:14px;margin-bottom:4px">` +
      `${heading.format(d)} ${hh}:00</div>` +
      `<div style="display:grid;grid-template-columns:auto auto;column-gap:12px;row-gap:2px">` +
      row(t(lang, "tooltip_temp"), `${temp}°`, tempCol) +
      row(t(lang, "tooltip_precip"), `${mm.toFixed(1)} mm (${prob}%)`, COL.precip) +
      row(t(lang, "tooltip_wind"), `${spd} m/s`, COL.wind) +
      row(t(lang, "tooltip_gust"), `${gust} m/s`, COL.wind) +
      `</div>`
    );
  };
}

export function meteogramOption(
  data: TimedForecast[],
  hours: string[],
  th: ThemeColors,
  bounds: AxisBounds,
  windDir: "source" | "target" = "source",
  lang?: string,
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
  // wind_bearing is a compass angle (clockwise from north = direction wind comes
  // FROM). "source" points the arrow straight at the bearing (toward where wind
  // comes from); "target" flips 180° to point where it blows to. symbolRotate is
  // counter-clockwise-positive, so the clockwise compass angle is negated to
  // become a screen rotation, else E/W mirror.
  const flip = windDir === "target" ? 180 : 0;
  const arrows = data.map((f, i) => ({
    value: [i, 0],
    symbolRotate: -num(f.wind_bearing) + flip,
  }));
  const times = data.map((f) => f.t);
  // Condition icons are NOT an ECharts symbol series: image:// symbols rasterize
  // to a static <image>, killing the SVGs' built-in SMIL animation. The card
  // overlays real <img> elements over the chart instead (see card.ts).

  return {
    animation: false,
    grid: GRIDS,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      formatter: tooltipFormatter(data, lang),
    },
    // Top-level axisPointer: `link` only takes effect here (ignored under
    // tooltip.axisPointer). Linking all x-axes by value makes hovering either
    // grid draw the vertical marker strip in BOTH grids, synced to the same hour.
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    // Color the temp line by value: red when warm, blue when cold, with a smooth
    // gradient crossing over at 4°C. Continuous visualMap interpolates the color
    // per y-value along the line (seriesIndex 0 = temp). The crossover sits at the
    // midpoint of [min,max], so we pin a tight band centered on 4° — values outside
    // clamp to the endpoint color, values inside blend. color[0] maps to max.
    visualMap: {
      show: false,
      type: "continuous",
      seriesIndex: 0,
      dimension: 1,
      min: 1,
      max: 7,
      // inRange.color maps max→min, so [warm, cold] = red at the top, blue at the
      // bottom, blending through the 1–7° band.
      inRange: { color: [COL.tempCold, COL.tempWarm] },
    },
    // Index 2: hidden twin of axis 0 (same top grid) for the probability bar.
    // Two differently-sized bars on one category axis get edge-aligned by barGap,
    // pushing the narrow mm bar off the band center vs the line points. A solo bar
    // per axis centers on its band, so mm bar, prob bar and line all line up.
    xAxis: [
      xAxis(hours, 0, true, th, "top", times, lang),
      xAxis(hours, 1, false, th),
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
        name: t(lang, "chart_temp"),
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: temps,
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { width: 2 },
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
        name: t(lang, "chart_probability"),
        type: "bar",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: prob,
        barWidth: "72%",
        itemStyle: { color: COL.precip, opacity: 0.18 },
        z: 1,
      },
      {
        name: t(lang, "chart_precip"),
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
        name: t(lang, "chart_wind"),
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
        name: t(lang, "chart_gust"),
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
        name: t(lang, "chart_direction"),
        type: "scatter",
        xAxisIndex: 1,
        yAxisIndex: 3,
        data: arrows,
        symbol: "path://M0,-5 L-3,4 L0,2 L3,4 Z",
        symbolSize: 11,
        // Anchored at the wind grid bottom axis (y=0); push down past the hour
        // labels so arrows render below them, not inside the chart band.
        symbolOffset: [0, 14],
        itemStyle: { color: th.sec },
        silent: true,
        z: 4,
      },
    ],
  };
}
