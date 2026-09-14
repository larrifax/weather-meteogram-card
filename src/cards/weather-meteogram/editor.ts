import type { LovelaceCardEditor } from "custom-card-helpers";
import type { Hass } from "../../ha-dom";
import { EDITOR_NAME } from "./const";
import type { MeteogramConfig } from "./config";

const numberSelector = { number: { mode: "box" as const } };

const EDITOR_SCHEMA = [
  {
    name: "entity",
    required: true,
    selector: { entity: { domain: "weather" } },
  },
  { name: "title", selector: { text: {} } },
  { name: "use_climate_normals", selector: { boolean: {} } },
  {
    name: "wind_direction",
    selector: {
      select: {
        mode: "dropdown" as const,
        options: [
          { value: "source", label: "Peker mot kilde (fra)" },
          { value: "target", label: "Peker mot mål (til)" },
        ],
      },
    },
  },
  {
    name: "",
    type: "grid",
    schema: [
      { name: "temp_min", selector: numberSelector },
      { name: "temp_max", selector: numberSelector },
      { name: "precip_max", selector: numberSelector },
    ],
  },
];

const LABELS: Record<string, string> = {
  entity: "Værenhet",
  title: "Tittel",
  use_climate_normals: "Bruk klimanormaler",
  wind_direction: "Vindpilretning",
  temp_min: "Min temp (°)",
  temp_max: "Maks temp (°)",
  precip_max: "Maks nedbør (mm)",
};

export class WeatherMeteogramCardEditor extends HTMLElement implements LovelaceCardEditor {
  private _hass?: Hass;
  private _config?: MeteogramConfig;
  private _form?: any;

  public setConfig(config: MeteogramConfig): void {
    this._config = config;
    this._render();
  }

  public set hass(hass: Hass) {
    this._hass = hass;
    this._render();
  }

  private _render(): void {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s: { name: string }) => LABELS[s.name] ?? s.name;
      this._form.addEventListener("value-changed", (e: CustomEvent) => {
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: e.detail.value },
          }),
        );
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = EDITOR_SCHEMA;
    this._form.data = { ...this._config };
  }
}

customElements.define(EDITOR_NAME, WeatherMeteogramCardEditor);
