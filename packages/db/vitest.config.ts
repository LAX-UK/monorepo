import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    ...(process.env.MIGRATION_TEST_DATABASE_URL
      ? {
          // Disposable-database integration tests share one Postgres admin catalog.
          fileParallelism: false,
          maxWorkers: 1,
        }
      : {}),
  },
});
