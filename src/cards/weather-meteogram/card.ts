import type { ECharts } from "echarts/core";
import * as echarts from "../../echarts";
import type { LovelaceCard } from "custom-card-helpers";
import { GRID, ICONS, type ThemeColors } from "../../const";
import { paginate, type ForecastHour, type TimedForecast } from "../../forecast";
import type { ChartKey, ForecastEvent, Hass } from "../../ha-dom";
import { tempOption } from "../../charts/temp";
import { precipOption } from "../../charts/precip";
import { windOption } from "../../charts/wind";
import { CARD_NAME, EDITOR_NAME } from "./const";
import type { MeteogramConfig } from "./config";
import "./editor";

const CHART_WEIGHTS: Record<ChartKey, number> = {
  temp: 3,
  precip: 3,
  wind: 2.4,
};

interface Els {
  wrap: HTMLElement;
  icons: HTMLElement;
  temp: HTMLElement;
  precip: HTMLElement;
  wind: HTMLElement;
  dots: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
}

export class WeatherMeteogramCard extends HTMLElement implements LovelaceCard {
  private _hass?: Hass;
  private _entity?: string;
  private _title = "Vær";
  private _page = 0;
  private _forecast: ForecastHour[] = [];
  private _pages: TimedForecast[][] = [];

  private _sub = false;
  private _unsub?: () => void;
  private _ready?: Promise<void>;
  private _charts?: Record<ChartKey, ECharts>;
  private _ro?: ResizeObserver;
  private _el?: Els;

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
    if (this._charts) Object.values(this._charts).forEach((c) => c.dispose());
    this._charts = undefined;
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
  }

  private _ensure(): Promise<void> {
    if (this._ready) return this._ready;
    this._ready = (async () => {
      this._build();
      const el = this._el!;
      // SVG renderer: the canvas renderer left blank (correctly-sized) charts in
      // the sections-grid shadow DOM; SVG sidesteps the canvas paint quirk.
      const opt = { renderer: "svg" as const };
      this._charts = {
        temp: echarts.init(el.temp, null, opt),
        precip: echarts.init(el.precip, null, opt),
        wind: echarts.init(el.wind, null, opt),
      };
      // Shared group → connect() syncs crosshair + tooltip across the charts.
      const group = "wm-" + Math.random().toString(36).slice(2);
      Object.values(this._charts).forEach((c) => (c.group = group));
      echarts.connect(group);
      // Flex won't reliably hand ECharts a non-zero height here, so drive sizing
      // ourselves: measure .wrap and split it into explicit pixel heights.
      this._ro = new ResizeObserver(() => this._sizeCharts());
      this._ro.observe(el.wrap);
    })();
    return this._ready;
  }

  // Split .wrap's height (minus the icon row) across the three charts by weight,
  // set each div's pixel height, and resize ECharts to those exact numbers.
  private _sizeCharts(): void {
    if (!this._charts || !this._el) return;
    const el = this._el;
    const w = el.temp.clientWidth || el.wrap.clientWidth;
    const avail = el.wrap.clientHeight - el.icons.offsetHeight;
    if (w <= 0 || avail <= 0) return;
    const total = CHART_WEIGHTS.temp + CHART_WEIGHTS.precip + CHART_WEIGHTS.wind;
    (Object.keys(this._charts) as ChartKey[]).forEach((k) => {
      const h = Math.floor((avail * CHART_WEIGHTS[k]) / total);
      el[k].style.height = h + "px";
      this._charts![k].resize({ width: w, height: h });
    });
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
          <div class="icons"></div>
          <div class="chart temp"></div>
          <div class="chart precip"></div>
          <div class="chart wind"></div>
        </div>
        <div class="dots"></div>
      </ha-card>
      <style>
        ha-card { padding: 8px 4px 4px; height:100%; min-height:320px; box-sizing:border-box; display:flex; flex-direction:column; }
        .hdr { display:flex; align-items:center; justify-content:space-between; padding:0 12px; }
        .ttl { font-size:1.1em; font-weight:500; }
        .nav ha-icon-button[disabled] { opacity:.3; pointer-events:none; }
        .wrap { flex:1; min-height:0; display:flex; flex-direction:column; touch-action: pan-y; }
        .icons { display:flex; padding-left:${GRID.left}px; padding-right:${GRID.right}px; flex:0 0 auto; }
        .icons > span { flex:1; text-align:center; --mdc-icon-size:22px; color:var(--paper-item-icon-color,#7a8ba0); }
        .chart { width:100%; }
        .dots { display:flex; gap:6px; justify-content:center; padding:6px 0 4px; }
        .dot { width:8px; height:8px; border-radius:50%; background:var(--disabled-text-color); cursor:pointer; }
        .dot.on { background:var(--primary-color); }
      </style>`;
    const q = <T extends HTMLElement>(sel: string) => this.querySelector(sel) as T;
    this._el = {
      wrap: q(".wrap"),
      icons: q(".icons"),
      temp: q(".chart.temp"),
      precip: q(".chart.precip"),
      wind: q(".chart.wind"),
      dots: q(".dots"),
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
    this._el.dots.onclick = (e: MouseEvent) => {
      const p = (e.target as HTMLElement).dataset?.p;
      if (p != null) {
        this._page = +p;
        this._render();
      }
    };
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
    if (!this._el || !this._charts) return;
    const pages = paginate(this._forecast, Date.now());
    // No forecast yet: keep the built (empty) charts and wait for data rather than
    // replacing the DOM with an error, which would detach the chart containers.
    if (!pages.length) return;
    this._pages = pages;
    this._page = Math.min(this._page, pages.length - 1);
    const data = pages[this._page];
    const hours = data.map((f) => String(new Date(f.t).getHours()).padStart(2, "0"));
    const th = this._themeColors();

    this._el.icons.innerHTML = data
      .map(
        (f) =>
          `<span><ha-icon icon="${ICONS[f.condition ?? ""] ?? ICONS.exceptional}"></ha-icon></span>`,
      )
      .join("");

    // Size the containers BEFORE setOption so ECharts lays the series out into a
    // non-zero box; otherwise the grid computes at height 0 and nothing paints.
    this._sizeCharts();
    try {
      this._charts.temp.setOption(tempOption(data, hours, th), true);
      this._charts.precip.setOption(precipOption(data, hours, th), true);
      this._charts.wind.setOption(windOption(data, hours, th), true);
    } catch (err) {
      console.error("[weather-meteogram] setOption failed:", err);
      this._error("setOption feilet: " + String((err as Error).message ?? err));
      return;
    }
    // If the first paint happened before layout settled, size once more next frame.
    requestAnimationFrame(() => this._sizeCharts());

    this._el.dots.innerHTML = pages
      .map((_, i) => `<span class="dot ${i === this._page ? "on" : ""}" data-p="${i}"></span>`)
      .join("");
    this._el.prev.disabled = this._page === 0;
    this._el.next.disabled = this._page === pages.length - 1;
  }
}
