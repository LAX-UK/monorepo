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
    // Parallel forks (not threads): Radix popover/cmdk + jsdom can hang under pool:threads.
    ...(ci
      ? {
          fileParallelism: true,
          maxWorkers: 2,
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
      ...workspaceSourceAliases(["@auction/ui", "@auction/marketing-ui", "@auction/lax-ecosystem"]),
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
