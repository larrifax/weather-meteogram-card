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
  const charts = ["temp", "precip", "wind"].map((k) => {
    const s = q(`.chart.${k} svg`);
    return {
      k,
      paths: s?.querySelectorAll("path").length ?? -1,
      texts: s?.querySelectorAll("text").length ?? -1,
    };
  });
  return {
    charts,
    dots: q(".dots")?.childElementCount,
    icons: q(".icons")?.childElementCount,
    error: card.querySelector('[style*="error"]')?.textContent ?? null,
  };
});

console.log("pageerrors:", errors.length ? errors : "none");
console.log(JSON.stringify(report, null, 2));

const ok =
  errors.length === 0 &&
  report.charts.every((c) => c.paths > 5 && c.texts > 0) &&
  report.icons === 12 &&
  report.dots === 4 &&
  !report.error;
console.log(ok ? "VERIFY: PASS" : "VERIFY: FAIL");

await browser.close();
server.close();
process.exit(ok ? 0 : 1);
