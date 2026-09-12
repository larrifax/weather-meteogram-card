import { defineConfig } from "vite";

export default defineConfig({
  // Bundled deps guard on process.env.NODE_ENV, which doesn't exist in the
  // browser; pin it so the prod branches compile in and the dev checks drop out.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    // HA targets modern browsers; this matches its own baseline.
    target: ["chrome111", "edge111", "firefox111", "safari16"],
    minify: true,
    lib: {
      entry: "src/weather-meteogram-card.ts",
      formats: ["es"],
      fileName: () => "weather-meteogram-card.js",
    },
    rollupOptions: {
      // Single self-contained file so HACS serves one asset (ECharts bundled in).
      output: { codeSplitting: false },
    },
  },
  preview: { port: 4000, host: "0.0.0.0", cors: true },
});
