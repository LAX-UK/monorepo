import { defineConfig } from "vitest/config";

const integrationDbConfigured =
  Boolean(process.env.MIGRATION_TEST_DATABASE_URL) && Boolean(process.env.DATABASE_URL_SHOP);

export default defineConfig({
  test: {
    environment: "node",
    ...(integrationDbConfigured
      ? {
          // Integration suites call applyApplicationRoleGrants against one admin catalog.
          fileParallelism: false,
          maxWorkers: 1,
        }
      : {}),
  },
});
