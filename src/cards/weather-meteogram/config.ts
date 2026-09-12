import type { LovelaceCardConfig } from "custom-card-helpers";

export interface MeteogramConfig extends LovelaceCardConfig {
  entity: string;
  title?: string;
}
