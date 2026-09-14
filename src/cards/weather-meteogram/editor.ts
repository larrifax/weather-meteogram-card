import type { LovelaceCardEditor } from "custom-card-helpers";
import type { Hass } from "../../ha-dom";
import { t, type TranslationKey } from "../../i18n";
import { EDITOR_NAME } from "./const";
import type { MeteogramConfig } from "./config";

const numberSelector = { number: { mode: "box" as const } };

// Schema + labels are built per-render from hass.language so the form localizes.
const schema = (lang?: string) => [
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
          { value: "source", label: t(lang, "editor_wind_direction_source") },
          { value: "target", label: t(lang, "editor_wind_direction_target") },
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

// Field name -> translation key for ha-form's computeLabel.
const LABEL_KEYS: Record<string, TranslationKey> = {
  entity: "editor_entity",
  title: "editor_title",
  use_climate_normals: "editor_use_climate_normals",
  wind_direction: "editor_wind_direction",
  temp_min: "editor_temp_min",
  temp_max: "editor_temp_max",
  precip_max: "editor_precip_max",
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
    const lang = this._hass.language;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s: { name: string }) => {
        const key = LABEL_KEYS[s.name];
        return key ? t(this._hass?.language, key) : s.name;
      };
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
    this._form.schema = schema(lang);
    this._form.data = { ...this._config };
  }
}

customElements.define(EDITOR_NAME, WeatherMeteogramCardEditor);
