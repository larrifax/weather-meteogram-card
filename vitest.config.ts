import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  // Same NODE_ENV pin as the prod build: bundled deps guard on it and the
  // browser has no process.env, so the prod branches must compile in.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  test: {
    // Git worktrees live under .claude/worktrees and carry their own test files;
    // don't run a sibling branch's suite from this checkout.
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/worktrees/**"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      // Default viewport is a 414px mobile size; the 703px screenshot host
      // overflowed it and Playwright's element capture clipped the right third
      // to white. Give the page room for the widest fixture.
      viewport: { width: 1024, height: 768 },
      instances: [{ browser: "chromium" }],
    },
  },
});
