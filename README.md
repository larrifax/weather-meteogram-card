# Weather Meteogram Card

An hourly weather meteogram for Home Assistant, built with [Apache ECharts](https://echarts.apache.org/).

Shows, top to bottom, for a 12-hour window:

- a **condition icon** per hour
- a **temperature** line
- **precipitation** bars (solid mm over a faint probability bar)
- **wind** — a shaded speed→gust band with per-hour direction arrows

The three charts share a cursor: hovering any of them syncs the crosshair and tooltip across all three. 48 hours are split into four 12-hour pages you move through by swiping, arrows, or the dots.

## Install

### HACS (recommended)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/larrifax/weather-meteogram-card`, category **Dashboard**.
2. Install **Weather Meteogram Card**.
3. HACS registers the resource automatically. If it doesn't, add it under **Settings → Dashboards → ⋮ → Resources**:
   - URL `/hacsfiles/weather-meteogram-card/weather-meteogram-card.js`, type **JavaScript Module**.

### Manual

1. Download `weather-meteogram-card.js` from the [latest release](https://github.com/larrifax/weather-meteogram-card/releases).
2. Copy it to `config/www/`.
3. Add the resource: URL `/local/weather-meteogram-card.js`, type **JavaScript Module**.

## Usage

```yaml
type: custom:weather-meteogram-card
entity: weather.your_weather_entity
title: Vær
```

| Option                | Type    | Default | Description                                             |
| --------------------- | ------- | ------- | ------------------------------------------------------- |
| `entity`              | string  | —       | A `weather.*` entity (required).                        |
| `title`               | string  | `Vær`   | Header title.                                           |
| `use_climate_normals` | boolean | `true`  | Widen axes with seasonal normals for the home location. |
| `temp_min`            | number  | auto    | Pin the temperature axis minimum (°).                   |
| `temp_max`            | number  | auto    | Pin the temperature axis maximum (°).                   |
| `precip_max`          | number  | auto    | Pin the precipitation axis maximum (mm).                |

The card is also configurable from the visual editor.

### Axis scales

By default the axes are derived from the **whole forecast** (not just the visible
12 h) and snapped to round steps, so they stay steady as you page between periods
and only shift when the data crosses a step boundary.

To keep the scale representative even when a period is quiet, the axes are also
widened with **seasonal climate normals** for the current month at your Home
location (`hass.config.latitude/longitude`). These come from the free
[Open-Meteo archive API](https://open-meteo.com/) (~10 years of daily data, cached
in the browser for a month) and only ever _widen_ the range — an extreme forecast
is never clipped. Set `use_climate_normals: false` to disable the network call, or
pin `temp_min` / `temp_max` / `precip_max` to hard-code your own normals (an
explicit value always wins).

### Sizing

The card fills its container (100% height, minimum 320px). Size it through the
dashboard: drag it in a **sections** view, put it in a **panel/grid** view, or
set a height with `card-mod`.

### Requirements

- The entity must provide an **hourly** forecast (the card subscribes via
  `weather.get_forecasts`, `type: hourly`). Most integrations (Met.no, …) do.
- ~48 hourly points are needed to fill all four pages; fewer just means fewer pages.

## Development

```bash
pnpm install
pnpm build       # → dist/weather-meteogram-card.js
pnpm typecheck
node test/verify.mjs   # headless render check (Playwright)
```

`dist/` is gitignored; the built file ships as a GitHub release asset.

## License

MIT — see [LICENSE](LICENSE).
