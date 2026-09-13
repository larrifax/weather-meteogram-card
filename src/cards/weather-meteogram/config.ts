import type { LovelaceCardConfig } from "custom-card-helpers";

export interface MeteogramConfig extends LovelaceCardConfig {
  entity: string;
  title?: string;
  // Pin axis bounds to local climate normals; otherwise derived from the forecast.
  temp_min?: number;
  temp_max?: number;
  precip_max?: number;
}
