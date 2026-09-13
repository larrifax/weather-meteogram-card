// Guards the top-axis hour labels against ECharts auto-dropping every-other-tick
// labels (the "first day only shows 00/06/12/18" regression). The fix pins
// axisLabel.interval to the formatter's every-even-tick cadence; if that pin is
// lost, interval falls back to "auto" and this test fails.
//
// Renders the real built bundle in a browser (Node can't import the TS module
// directly — extensionless imports) and reads the live chart's resolved option.
// Run: vite build && node test/labels.test.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import assert from "node:assert";
import path from "path";
import http from "http";
import fs from "fs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript" };
const server = http.createServer((req, res) => {
  const rel = req.url === "/" ? "test/harness.html" : req.url.split("?")[0];
  fs.readFile(path.join(root, rel), (err, buf) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(rel)] ?? "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/test/harness.html`);
await page.waitForTimeout(1500);

// Read the live chart's resolved option and exercise the top x-axis label config
// across a full 12-point page. Functions survive getOption(), so we can call
// interval/formatter directly with each tick index.
const report = await page.evaluate(() => {
  const chart = window.__card?._chart;
  if (!chart) return { mounted: false };
  const opt = chart.getOption();
  const label = opt.xAxis[0].axisLabel;
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const shown =
      typeof label.interval === "function" ? label.interval(i, String(i)) : label.interval;
    const text =
      typeof label.formatter === "function" ? label.formatter(String(i), i) : `${label.formatter}`;
    rows.push({ i, shown, hasText: text !== "" });
  }
  // The wind axis (xAxis[1]) must stay label-free — its hour labels were removed.
  const windShows = opt.xAxis[1].axisLabel?.show;
  return { mounted: true, intervalType: typeof label.interval, rows, windShows };
});

assert.equal(report.mounted, true, "card mounted");
assert.equal(errors.length, 0, `no page errors: ${errors.join("; ")}`);

// The core guard: interval must be an explicit function, not "auto" — "auto" is
// exactly what let ECharts drop the intermediate labels.
assert.equal(report.intervalType, "function", 'top-axis interval must be a function, not "auto"');

// Every even tick is labeled and carries text; every odd tick is suppressed.
// Label cadence and formatter cadence must agree, or blips and labels diverge.
for (const { i, shown, hasText } of report.rows) {
  const even = i % 2 === 0;
  assert.equal(shown, even, `tick ${i}: interval should ${even ? "show" : "hide"} the label`);
  assert.equal(hasText, even, `tick ${i}: formatter should ${even ? "emit" : "blank"} the label`);
}

assert.ok(!report.windShows, "wind axis must not render hour labels");

console.log("labels.test.mjs: PASS");
await browser.close();
server.close();
