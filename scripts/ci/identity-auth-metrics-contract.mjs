/** Prometheus metric names required on the live Identity /metrics exposition. */
export const IDENTITY_AUTH_METRIC_NAMES = [
  "auction_auth_refresh_rotation_outcomes_total",
  "auction_auth_identity_lifecycle_operations_total",
  "auction_auth_ssf_delivery_outcomes_total",
  "auction_auth_at_rest_pending",
];

/**
 * Labeled counters may only expose # HELP / # TYPE until first observation; gauges
 * and default metrics expose sample lines immediately. Match registration by name.
 */
export function findMissingAuthMetrics(body) {
  if (typeof body !== "string" || body.length === 0) {
    return [...IDENTITY_AUTH_METRIC_NAMES];
  }
  return IDENTITY_AUTH_METRIC_NAMES.filter((name) => !body.includes(name));
}

export function assertAuthMetricsRegistered(body) {
  const missing = findMissingAuthMetrics(body);
  if (missing.length > 0) {
    throw new Error(`Auth metrics exposition missing registered metrics: ${missing.join(", ")}`);
  }
}
