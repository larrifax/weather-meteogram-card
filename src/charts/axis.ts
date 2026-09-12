import type { ThemeColors } from "../const";

export function xAxis(hours: string[], showLabels: boolean, th: ThemeColors) {
  return {
    type: "category" as const,
    data: hours,
    boundaryGap: true,
    axisLine: { show: false },
    axisTick: { show: showLabels, alignWithLabel: true },
    axisLabel: { show: showLabels, fontSize: 10, color: th.sec },
  };
}
