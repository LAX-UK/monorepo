import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { workspaceSourceAliases } from "../../scripts/vitest/workspace-source-aliases.mjs";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [...workspaceSourceAliases(["@auction/ui"])],
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["**/react/**", "jsdom"]],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
