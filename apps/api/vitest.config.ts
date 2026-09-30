import { defineConfig } from "vitest/config";

const ci = process.env.CI === "true" || process.env.CI === "1";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // threads only in CI: isolate stays default (true) — isolate:false broke shared-state tests.
    ...(ci ? { pool: "threads" as const } : {}),
  },
});
