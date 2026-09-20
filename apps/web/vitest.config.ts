import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { workspaceSourceAliases } from "../../scripts/vitest/workspace-source-aliases.mjs";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    maxWorkers: process.env.CI ? 2 : "50%",
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
