import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";
import http from "http";
import fs from "fs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
};
const server = http.createServer((req, res) => {
  const rel = req.url === "/" ? "test/harness.html" : req.url.split("?")[0];
  const f = path.join(root, rel);
  fs.readFile(f, (err, buf) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(f)] ?? "application/octet-stream",
    });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});
await page.goto(`http://localhost:${port}/test/harness.html`);
await page.waitForTimeout(1500);

if (!(await page.evaluate(() => !!window.__card))) {
  console.log("pageerrors:", errors.length ? errors : "none");
  console.log("VERIFY: FAIL — card never mounted");
  await browser.close();
  server.close();
  process.exit(1);
}

const report = await page.evaluate(() => {
  const card = window.__card;
  const q = (sel) => card.querySelector(sel);
  const svg = q(".chart svg");
  return {
    paths: svg?.querySelectorAll("path").length ?? -1,
    texts: svg?.querySelectorAll("text").length ?? -1,
    dots: q(".dots")?.childElementCount,
    icons: q(".icons")?.childElementCount,
    error: card.querySelector('[style*="error"]')?.textContent ?? null,
  };
});

// Hover the chart, then count how many tooltip boxes ECharts renders. One shared
// tooltip is the whole point of the single-instance refactor.
const tooltipCount = await (async () => {
  const box = await page.locator("weather-meteogram-card .chart").boundingBox();
  if (!box) return -1;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const card = window.__card;
    const tips = [...card.querySelectorAll("div")].filter(
      (d) =>
        /position:\s*absolute/.test(d.getAttribute("style") || "") &&
        /:00/.test(d.textContent || ""),
    );
    return tips.length;
  });
})();

console.log("pageerrors:", errors.length ? errors : "none");
console.log(JSON.stringify({ ...report, tooltipCount }, null, 2));

const ok =
  errors.length === 0 &&
  report.paths > 15 &&
  report.texts > 10 &&
  report.icons === 12 &&
  report.dots === 4 &&
  tooltipCount === 1 &&
  !report.error;
console.log(ok ? "VERIFY: PASS" : "VERIFY: FAIL");

await browser.close();
server.close();
process.exit(ok ? 0 : 1);
