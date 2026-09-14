#!/usr/bin/env node
import { assertAuthMetricsRegistered } from "./identity-auth-metrics-contract.mjs";

const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");
const metricsToken = process.env.AUTH_METRICS_TOKEN;

if (new URL(authBase).protocol !== "https:") {
  throw new Error("AUTH_BASE_URL must use HTTPS for live acceptance");
}
if (!metricsToken) {
  throw new Error("AUTH_METRICS_TOKEN is required");
}

const metricsUrl = `${authBase}/metrics`;

const unauthenticated = await fetch(metricsUrl);
if (unauthenticated.status !== 401) {
  throw new Error(`Expected unauthenticated /metrics to return 401, got ${unauthenticated.status}`);
}

const authenticated = await fetch(metricsUrl, {
  headers: { Authorization: `Bearer ${metricsToken}` },
});
if (!authenticated.ok) {
  throw new Error(`Authenticated /metrics request failed with ${authenticated.status}`);
}

const body = await authenticated.text();
assertAuthMetricsRegistered(body);
console.log(
  JSON.stringify({
    checkedAt: new Date().toISOString(),
    metricsUrl,
    metricCount: body.split("\n").filter((line) => line && !line.startsWith("#")).length,
  }),
);
