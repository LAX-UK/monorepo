import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Next compiles JSX with the automatic runtime; tests that render components need the same.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    environmentMatchGlobs: [["**/art-theme.test.ts", "jsdom"]],
  },
});
