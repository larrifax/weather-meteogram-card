import type { LovelaceCardConfig } from "custom-card-helpers";

export interface MeteogramConfig extends LovelaceCardConfig {
  entity: string;
  title?: string;
  // Pin axis bounds to local climate normals; otherwise derived from the forecast.
  temp_min?: number;
  temp_max?: number;
  precip_max?: number;
  // Widen axes with seasonal normals fetched for the home location (default on).
  use_climate_normals?: boolean;
  // Which way wind arrows point: "source" (toward where wind comes FROM, default)
  // or "target" (toward where wind is blowing TO).
  wind_direction?: "source" | "target";
}
