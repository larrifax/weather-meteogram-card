import type { ECharts } from "echarts/core";
import * as echarts from "../../echarts";
import type { LovelaceCard } from "custom-card-helpers";
import { ICONS, type ThemeColors } from "../../const";
import { paginate, type ForecastHour, type TimedForecast } from "../../forecast";
import type { ForecastEvent, Hass } from "../../ha-dom";
import { meteogramOption } from "../../charts/meteogram";
import { computeBounds, type BoundsOverrides, type ClimateNormal } from "../../charts/bounds";
import { fetchClimateNormal } from "../../charts/climate";
import { CARD_NAME, EDITOR_NAME } from "./const";
import type { MeteogramConfig } from "./config";
import "./editor";

interface Els {
  wrap: HTMLElement;
  chart: HTMLElement;
  icons: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
}

// Icon box size in px. Bumped from the old 24px scatter symbol so the meteocon
// detail is legible.
const ICON_PX = 36;

export class WeatherMeteogramCard extends HTMLElement implements LovelaceCard {
  private _hass?: Hass;
  private _entity?: string;
  private _title = "Vær";
  private _bounds: BoundsOverrides = {};
  private _useClimate = true;
  private _windDir: "source" | "target" = "source";
  private _climate?: ClimateNormal;
  private _climateKey?: string;
  private _page = 0;
  private _forecast: ForecastHour[] = [];
  private _pages: TimedForecast[][] = [];

  private _sub = false;
  private _unsub?: () => void;
  private _ready?: Promise<void>;
  private _chart?: ECharts;
  private _ro?: ResizeObserver;
  private _el?: Els;
  private _iconTop = 0;

  public static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_NAME);
  }

  public static getStubConfig(hass: Hass): MeteogramConfig {
    const weather = Object.keys(hass.states).find((e) => e.startsWith("weather."));
    return {
      type: `custom:${CARD_NAME}`,
      entity: weather ?? "weather.home",
      title: "Vær",
    };
  }

  public setConfig(config: MeteogramConfig): void {
    if (!config.entity) throw new Error("Set 'entity' to a weather.* entity");
    this._entity = config.entity;
    this._title = config.title ?? "Vær";
    this._bounds = {
      tempMin: config.temp_min,
      tempMax: config.temp_max,
      precipMax: config.precip_max,
    };
    this._useClimate = config.use_climate_normals ?? true;
    this._windDir = config.wind_direction ?? "source";
    this._page = 0;
    void this._update();
  }

  // Sections dashboards: let the user drag-resize; default to a tall tile.
  public getGridOptions() {
    return { rows: 6, columns: 12, min_rows: 4, min_columns: 6 };
  }

  public set hass(hass: Hass) {
    this._hass = hass;
    if (!this._sub) void this._subscribe();
  }

  public getCardSize(): number {
    return 6;
  }

  public disconnectedCallback(): void {
    this._unsub?.();
    this._unsub = undefined;
    this._ro?.disconnect();
    this._chart?.dispose();
    this._chart = undefined;
    this._ready = undefined;
    this._sub = false;
  }

  private async _subscribe(): Promise<void> {
    if (!this._hass || !this._entity) return;
    this._sub = true;
    try {
      this._unsub = await this._hass.connection.subscribeMessage<ForecastEvent>(
        (e) => {
          this._forecast = (e.forecast as ForecastHour[]) ?? [];
          void this._update();
        },
        {
          type: "weather/subscribe_forecast",
          forecast_type: "hourly",
          entity_id: this._entity,
        },
      );
    } catch (err) {
      this._sub = false;
      this._error(String((err as Error).message ?? err));
    }
  }

  private _error(msg: string): void {
    this.innerHTML = `<ha-card><div style="padding:16px;color:var(--error-color)">${msg}</div></ha-card>`;
  }

  private async _update(): Promise<void> {
    if (!this._entity) return;
    try {
      await this._ensure();
    } catch (e) {
      this._error("Kunne ikke laste ECharts: " + String((e as Error).message ?? e));
      return;
    }
    this._render();
    void this._ensureClimate();
  }

  // Fetch seasonal normals once per location; re-render when they arrive. Failures
  // are silent — the axes just fall back to forecast-only bounds.
  private async _ensureClimate(): Promise<void> {
    if (!this._useClimate || !this._hass) return;
    const { latitude, longitude } = this._hass.config ?? {};
    if (typeof latitude !== "number" || typeof longitude !== "number") return;
    const key = `${latitude},${longitude}`;
    if (key === this._climateKey) return;
    this._climateKey = key;
    const normal = await fetchClimateNormal(latitude, longitude);
    if (normal) {
      this._climate = normal;
      this._render();
    }
  }

  private _ensure(): Promise<void> {
    if (this._ready) return this._ready;
    this._ready = (async () => {
      this._build();
      const el = this._el!;
      // SVG renderer: the canvas renderer left blank (correctly-sized) charts in
      // the sections-grid shadow DOM; SVG sidesteps the canvas paint quirk.
      this._chart = echarts.init(el.chart, null, { renderer: "svg" });
      // Flex won't reliably hand ECharts a non-zero height here, so drive sizing
      // ourselves: measure the chart box and resize to explicit pixels.
      this._ro = new ResizeObserver(() => this._sizeChart());
      this._ro.observe(el.wrap);
    })();
    return this._ready;
  }

  // Size the single chart to fill the wrap.
  private _sizeChart(): void {
    if (!this._chart || !this._el) return;
    const el = this._el;
    const w = el.chart.clientWidth || el.wrap.clientWidth;
    const h = el.wrap.clientHeight;
    if (w <= 0 || h <= 0) return;
    el.chart.style.height = h + "px";
    this._chart.resize({ width: w, height: h });
    this._positionIcons();
  }

  // Place each overlaid icon over its hour, just under the top grid's edge.
  // convertToPixel maps [category index, temp value] -> chart pixels; the icon
  // sits at the top temperature bound, matching the old scatter series.
  private _positionIcons(): void {
    if (!this._chart || !this._el) return;
    const imgs = this._el.icons.children;
    for (let i = 0; i < imgs.length; i++) {
      const px = this._chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [i, this._iconTop]);
      if (!px) continue;
      const img = imgs[i] as HTMLElement;
      img.style.left = px[0] + "px";
      img.style.top = px[1] + ICON_PX / 2 + "px";
    }
  }

  private _build(): void {
    this.innerHTML = `
      <ha-card>
        <div class="hdr">
          <span class="ttl"></span>
          <span class="nav">
            <ha-icon-button class="prev"><ha-icon icon="mdi:chevron-left"></ha-icon></ha-icon-button>
            <ha-icon-button class="next"><ha-icon icon="mdi:chevron-right"></ha-icon></ha-icon-button>
          </span>
        </div>
        <div class="wrap">
          <div class="chart"></div>
          <div class="icons"></div>
        </div>
      </ha-card>
      <style>
        ha-card { padding: 8px 4px 4px; height:100%; min-height:320px; box-sizing:border-box; display:flex; flex-direction:column; }
        .hdr { display:flex; align-items:center; justify-content:space-between; padding:0 12px; }
        .ttl { font-size:1.1em; font-weight:500; }
        .nav ha-icon-button { --mdc-icon-button-size:32px; --mdc-icon-size:20px; }
        .nav ha-icon-button[disabled] { opacity:.3; pointer-events:none; }
        .wrap { flex:1; min-height:0; display:flex; flex-direction:column; position:relative; touch-action: pan-y; }
        .chart { width:100%; flex:1; min-height:0; }
        /* Animated condition icons overlaid on the chart; positioned in JS. */
        .icons { position:absolute; inset:0; pointer-events:none; }
        .icons img { position:absolute; width:${ICON_PX}px; height:${ICON_PX}px; transform:translate(-50%,-50%); }
      </style>`;
    const q = <T extends HTMLElement>(sel: string) => this.querySelector(sel) as T;
    this._el = {
      wrap: q(".wrap"),
      chart: q(".chart"),
      icons: q(".icons"),
      prev: q(".prev"),
      next: q(".next"),
    };
    q(".ttl").textContent = this._title;

    const go = (d: number) => {
      const n = this._page + d;
      if (n >= 0 && n < (this._pages.length || 1)) {
        this._page = n;
        this._render();
      }
    };
    this._el.prev.onclick = () => go(-1);
    this._el.next.onclick = () => go(1);
    let x0: number | null = null;
    this._el.wrap.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), {
      passive: true,
    });
    this._el.wrap.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      x0 = null;
    });
  }

  private _themeColors(): ThemeColors {
    const cs = getComputedStyle(this);
    const c = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
    return {
      sec: c("--secondary-text-color", "#8a94a6"),
      pri: c("--primary-text-color", "#e1e1e1"),
    };
  }

  private _render(): void {
    if (!this._el || !this._chart) return;
    const pages = paginate(this._forecast, Date.now());
    // No forecast yet: keep the built (empty) chart and wait for data rather than
    // replacing the DOM with an error, which would detach the chart container.
    if (!pages.length) return;
    // Bounds over the whole forecast (all pages), not just the current one, so
    // the axes hold steady as the user swipes between periods.
    const bounds = computeBounds(pages.flat(), this._bounds, this._climate);
    this._pages = pages;
    this._page = Math.min(this._page, pages.length - 1);
    const data = pages[this._page];
    const hours = data.map((f) => String(new Date(f.t).getHours()).padStart(2, "0"));
    const th = this._themeColors();

    // Size the container BEFORE setOption so ECharts lays the series out into a
    // non-zero box; otherwise the grid computes at height 0 and nothing paints.
    this._sizeChart();
    try {
      this._chart.setOption(meteogramOption(data, hours, th, bounds, this._windDir), true);
    } catch (err) {
      console.error("[weather-meteogram] setOption failed:", err);
      this._error("setOption feilet: " + String((err as Error).message ?? err));
      return;
    }
    // Animated <img> icons overlaid on the top grid, one per hour. Kept as real
    // DOM (not an ECharts symbol) so the meteocons' SMIL animation runs.
    this._el.icons.innerHTML = data
      .map((f) => {
        const src = ICONS[f.condition ?? ""] ?? ICONS.exceptional;
        return `<img src="${src}" alt="${f.condition ?? ""}">`;
      })
      .join("");
    this._iconTop = bounds.tempMax;
    // If the first paint happened before layout settled, size once more next frame.
    requestAnimationFrame(() => this._sizeChart());

    this._el.prev.disabled = this._page === 0;
    this._el.next.disabled = this._page === pages.length - 1;
  }
}
