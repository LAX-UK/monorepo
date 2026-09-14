#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contractPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../docs/runbooks/identity-soak-thresholds.json",
);

export function loadIdentitySoakThresholdContract() {
  return JSON.parse(readFileSync(contractPath, "utf8"));
}

/**
 * @param {object} sample - soak-sample.json payload
 * @param {object} [contract] - optional override for tests
 */
export function assertSampleMeetsSoakThresholds(
  sample,
  contract = loadIdentitySoakThresholdContract(),
) {
  const violations = [];

  if (sample.probeStatus === "failed") {
    violations.push(`probe failed: ${sample.probeError ?? "unknown"}`);
  }

  const ready = sample.ready ?? {};
  for (const key of contract.criticalReadiness ?? ["status", "database", "redis", "jwks"]) {
    if (ready[key] !== "ok") {
      violations.push(`readiness.${key}=${ready[key] ?? "missing"}`);
    }
  }

  if (sample.directoryDrift?.orphan > 0) {
    violations.push(`directory orphan=${sample.directoryDrift.orphan}`);
  }
  if (sample.directoryDrift?.missing > 0) {
    violations.push(`directory missing=${sample.directoryDrift.missing}`);
  }
  if (sample.directoryDrift?.mismatched > 0) {
    violations.push(`directory mismatched=${sample.directoryDrift.mismatched}`);
  }
  if (sample.directoryDrift?.pendingEvents > 0) {
    violations.push(`directory pending_events=${sample.directoryDrift.pendingEvents}`);
  }
  const maxLag = contract.directoryMaxProcessingLagMs ?? 60_000;
  if (
    typeof sample.directoryDrift?.maxProcessingLagMs === "number" &&
    sample.directoryDrift.maxProcessingLagMs > maxLag
  ) {
    violations.push(`directory max_processing_lag_ms=${sample.directoryDrift.maxProcessingLagMs}`);
  }

  if (
    typeof sample.outbox?.maxPendingAgeMs === "number" &&
    sample.outbox.maxPendingAgeMs > (contract.outboxMaxPendingAgeMs ?? 300_000)
  ) {
    violations.push(`outbox max_pending_age_ms=${sample.outbox.maxPendingAgeMs}`);
  }

  const metrics = sample.metrics ?? {};
  if (
    typeof metrics.authAtRestPending === "number" &&
    metrics.authAtRestPending > (contract.authAtRestPendingMax ?? 0)
  ) {
    violations.push(`auth_at_rest_pending=${metrics.authAtRestPending}`);
  }
  if (
    typeof metrics.http5xxRate === "number" &&
    metrics.httpRequestsTotal >= (contract.httpMinRequestsForRate ?? 1) &&
    metrics.http5xxRate > (contract.http5xxRateMax ?? 0.05)
  ) {
    violations.push(`http_5xx_rate=${metrics.http5xxRate}`);
  }
  if (
    typeof metrics.ssfDeliveryFailedTotal === "number" &&
    metrics.ssfDeliveryFailedTotal > (contract.ssfDeliveryFailedMax ?? 0)
  ) {
    violations.push(`ssf_delivery_failed=${metrics.ssfDeliveryFailedTotal}`);
  }
  if (
    typeof metrics.backchannelDeliveryFailedTotal === "number" &&
    metrics.backchannelDeliveryFailedTotal > (contract.backchannelDeliveryFailedMax ?? 0)
  ) {
    violations.push(`backchannel_delivery_failed=${metrics.backchannelDeliveryFailedTotal}`);
  }

  if (violations.length > 0) {
    throw new Error(`Soak threshold violations: ${violations.join("; ")}`);
  }
}
