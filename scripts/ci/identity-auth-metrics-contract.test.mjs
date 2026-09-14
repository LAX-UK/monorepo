import assert from "node:assert/strict";
import test from "node:test";
import {
  IDENTITY_AUTH_METRIC_NAMES,
  assertAuthMetricsRegistered,
  findMissingAuthMetrics,
} from "./identity-auth-metrics-contract.mjs";

const labeledCounterOnlyHelpType = `
# HELP auction_auth_ssf_delivery_outcomes_total First-party SSF push delivery outcomes.
# TYPE auction_auth_ssf_delivery_outcomes_total counter
# HELP auction_auth_refresh_rotation_outcomes_total OIDC refresh rotation outcomes.
# TYPE auction_auth_refresh_rotation_outcomes_total counter
auction_auth_refresh_rotation_outcomes_total{outcome="rotated"} 1
# HELP auction_auth_identity_lifecycle_operations_total Successful privileged Identity lifecycle operations.
# TYPE auction_auth_identity_lifecycle_operations_total counter
# HELP auction_auth_at_rest_pending 1 when legacy plaintext auth material remains.
# TYPE auction_auth_at_rest_pending gauge
auction_auth_at_rest_pending 0
`.trim();

test("findMissingAuthMetrics accepts HELP/TYPE-only labeled counters", () => {
  assert.deepEqual(findMissingAuthMetrics(labeledCounterOnlyHelpType), []);
  assert.doesNotThrow(() => assertAuthMetricsRegistered(labeledCounterOnlyHelpType));
});

test("findMissingAuthMetrics reports absent registrations", () => {
  const missing = findMissingAuthMetrics("# TYPE auction_auth_at_rest_pending gauge\n");
  assert.deepEqual(
    missing,
    IDENTITY_AUTH_METRIC_NAMES.filter((n) => n !== "auction_auth_at_rest_pending"),
  );
});

test("anchored sample-line grep would fail ssf_disabled exposition", () => {
  const body = labeledCounterOnlyHelpType;
  for (const name of IDENTITY_AUTH_METRIC_NAMES) {
    assert.match(body, new RegExp(name));
  }
  assert.doesNotMatch(body, /^auction_auth_ssf_delivery_outcomes_total/m);
});
