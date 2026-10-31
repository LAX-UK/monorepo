import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    // Child processes, not worker threads (the Vitest 3 default, pinned so an upgrade cannot
    // change it). A jsdom file that spins its CPU then blocks only its own process, not a thread
    // sharing the runner's event loop, which is how `Timeout calling "onTaskUpdate"` surfaced.
    pool: "forks",
    // A file's jsdom window and React trees must be gone before the worker stops; give the
    // teardown room on a loaded runner so a slow cleanup is not reported as an unhandled error.
    teardownTimeout: 10_000,
    // testTimeout stays at the 5s default: with the nwsapi pin (see the root package.json
    // overrides) the slowest test takes well under a second, so a timeout is a real hang.
  },
});
