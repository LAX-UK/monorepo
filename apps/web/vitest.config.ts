import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { workspaceSourceAliases } from "../../scripts/vitest/workspace-source-aliases.mjs";

const ci = process.env.CI === "true" || process.env.CI === "1";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // jsdom + Vite transform saturates Vitest worker RPC on shared CI runners.
    ...(ci
      ? {
          fileParallelism: false,
          maxWorkers: 1,
          teardownTimeout: 30_000,
          pool: "forks" as const,
        }
      : { maxWorkers: "50%" }),
    server: {
      deps: {
        inline: [/@auction\/(ui|marketing-ui)/],
      },
    },
  },
  resolve: {
    alias: [
      ...workspaceSourceAliases(["@auction/ui", "@auction/marketing-ui"]),
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
