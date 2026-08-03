#!/usr/bin/env node
/**
 * Captures coarse `/admin` dashboard loader timing for local evidence.
 * Usage: node apps/web/scripts/capture-admin-dashboard-baseline.mjs
 */
import { performance } from "node:perf_hooks";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

async function measure(path, label) {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const elapsed = Math.round(performance.now() - start);
  return { label, path, status: res.status, ms: elapsed };
}

const routes = [
  { path: "/admin", label: "admin-home" },
  { path: "/admin/login", label: "admin-login-redirect-check" },
];

console.log(`[dashboard-baseline] base=${BASE}`);
for (const route of routes) {
  try {
    const result = await measure(route.path, route.label);
    console.log(JSON.stringify({ kind: "route_timing", ...result }));
  } catch (error) {
    console.log(
      JSON.stringify({
        kind: "route_timing_error",
        label: route.label,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

console.log(
  JSON.stringify({
    kind: "dashboard_baseline_hint",
    message:
      "For authenticated slice timings, run vitest load-admin-dashboard-page tests and compare loader phases in PR notes.",
  }),
);
