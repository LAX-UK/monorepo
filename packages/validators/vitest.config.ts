import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /** `notification.test.ts` uses `node:test`; keep Vitest suites separate. */
    exclude: ["src/notification.test.ts"],
  },
});
