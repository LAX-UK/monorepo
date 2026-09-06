import { defineConfig } from "vitest/config";

const serializeDbIntegrationTests = Boolean(process.env.CI && process.env.DATABASE_URL);

export default defineConfig({
  test: {
    environment: "node",
    ...(serializeDbIntegrationTests
      ? {
          fileParallelism: false,
          maxWorkers: 1,
        }
      : {}),
  },
});
