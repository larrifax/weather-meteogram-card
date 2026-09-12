// Tree-shaken ECharts: register only the chart types and components this card
// uses, via the SVG renderer, instead of pulling the full 2.5 MB bundle.
import { init, connect, use } from "echarts/core";
import { LineChart, BarChart, ScatterChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

use([LineChart, BarChart, ScatterChart, GridComponent, TooltipComponent, SVGRenderer]);

export { init, connect };
