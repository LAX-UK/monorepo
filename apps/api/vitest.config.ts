import { defineConfig } from "vitest/config";

const ci = process.env.CI === "true" || process.env.CI === "1";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    ...(ci
      ? {
          pool: "threads" as const,
          isolate: false,
        }
      : {}),
  },
});
