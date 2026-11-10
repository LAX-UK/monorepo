import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Snapshot sweeps pin output for call sites that format in the runtime's own zone; servers run
    // in UTC, so the tests do too, whatever zone the developer's machine is in.
    env: { TZ: "UTC" },
  },
});
