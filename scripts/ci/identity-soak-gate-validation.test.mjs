import assert from "node:assert/strict";
import test from "node:test";
import { assertSampleMeetsSoakThresholds } from "./identity-soak-threshold-contract.mjs";
import { parseAuthSoakMetrics } from "./parse-auth-soak-metrics.mjs";

const contract = {
  criticalReadiness: ["status", "database", "redis", "jwks"],
  directoryMaxProcessingLagMs: 60_000,
  outboxMaxPendingAgeMs: 300_000,
  authAtRestPendingMax: 0,
  httpMinRequestsForRate: 10,
  http5xxRateMax: 0.05,
  ssfDeliveryFailedMax: 0,
  backchannelDeliveryFailedMax: 0,
};

function passingSample() {
  return {
    probeStatus: "ok",
    ready: { status: "ok", database: "ok", redis: "ok", jwks: "ok" },
    directoryDrift: {
      missing: 0,
      orphan: 0,
      mismatched: 0,
      pendingEvents: 0,
      maxProcessingLagMs: 0,
    },
    outbox: { maxPendingAgeMs: 0 },
    metrics: {
      authAtRestPending: 0,
      httpRequestsTotal: 100,
      http5xxRate: 0,
      ssfDeliveryFailedTotal: 0,
      backchannelDeliveryFailedTotal: 0,
    },
  };
}

test("A-A soak gate passes a healthy sample", () => {
  assert.doesNotThrow(() => assertSampleMeetsSoakThresholds(passingSample(), contract));
});

test("soak gate fails on injected directory orphan drift", () => {
  const sample = passingSample();
  sample.directoryDrift.orphan = 3;
  assert.throws(() => assertSampleMeetsSoakThresholds(sample, contract), /orphan=3/);
});

test("parseAuthSoakMetrics aggregates issuer http and lifecycle counters", () => {
  const text = `
# HELP auction_auth_issuer_http_outcomes_total test
# TYPE auction_auth_issuer_http_outcomes_total counter
auction_auth_issuer_http_outcomes_total{operation="sign_in",status="2xx"} 10
auction_auth_issuer_http_outcomes_total{operation="sign_in",status="5xx"} 1
auction_auth_refresh_rotation_outcomes_total{outcome="rotated"} 2
auction_auth_at_rest_pending 0
`;
  const parsed = parseAuthSoakMetrics(text);
  assert.equal(parsed.httpRequestsTotal, 11);
  assert.equal(parsed.http5xxTotal, 1);
  assert.equal(parsed.operations, 2);
});
