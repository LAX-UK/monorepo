import path from "node:path";
import { defineConfig } from "vitest/config";
import { workspaceSourceAliases } from "../../scripts/vitest/workspace-source-aliases.mjs";

export default defineConfig({
  resolve: {
    alias: [
      ...workspaceSourceAliases(["@auction/ui", "@auction/marketing-ui"]),
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
    ],
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["**/shop-theme.test.ts", "jsdom"]],
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
    server: {
      deps: {
        inline: [/@auction\/(ui|marketing-ui)/],
      },
    },
    ...(process.env.CI
      ? {
          // jsdom + Next imports are heavy; serialize in CI so Vitest worker RPC does not time out
          // when turbo runs @auction/api and other packages' tests on the same host.
          testTimeout: 30_000,
          hookTimeout: 30_000,
          fileParallelism: false,
          maxWorkers: 1,
          pool: "forks" as const,
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
        }
      : {}),
  },
});
