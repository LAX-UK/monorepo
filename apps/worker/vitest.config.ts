import { configDefaults, defineConfig } from "vitest/config";

/**
 * The critical notification wake test holds a real-time budget: a committed outbid notice is
 * delivered within 3 s, through Postgres, Redis and the worker. Every integration file here shares
 * one database and one Redis, and in merge-queue run 43928262155 a delivery took 3810 ms while the
 * file running beside it stalled for the same few seconds (4150 ms against its usual ~200 ms). The
 * test therefore runs in its own project, in a later group: it starts once every other file of
 * this package has finished, so nothing else is using the database or Redis while it measures.
 * Every other file still runs in parallel, as before.
 */
const DEDICATED = ["src/notifications/notification-outbox-wake.integration.test.ts"];

export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "worker",
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...DEDICATED],
        },
      },
      {
        extends: true,
        test: {
          name: "worker-realtime",
          include: DEDICATED,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
