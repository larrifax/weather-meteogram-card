import type { HomeAssistant } from "custom-card-helpers";

/** Minimal shape of the forecast subscription message payload. */
export interface ForecastEvent {
  forecast?: unknown[];
}

/** The subset of HomeAssistant.connection we use (typed loosely; ha types omit it). */
export interface HassConnection {
  subscribeMessage<T>(
    callback: (msg: T) => void,
    subscription: Record<string, unknown>,
  ): Promise<() => void>;
}

export type Hass = HomeAssistant & { connection: HassConnection };

/** ECharts render modes we pass around. */
export type ChartKey = "temp" | "precip" | "wind";
