#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { assertSampleMeetsSoakThresholds } from "./identity-soak-threshold-contract.mjs";
import { parseAuthSoakMetrics } from "./parse-auth-soak-metrics.mjs";

const samplePath = process.env.SOAK_SAMPLE_PATH;
const identitySha = process.env.IDENTITY_SHA;
const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");
const validationMode = process.env.SOAK_VALIDATION_MODE ?? "enforce";
const sampleKind = process.env.SOAK_SAMPLE_KIND ?? "probe";

if (!samplePath) {
  throw new Error("SOAK_SAMPLE_PATH is required");
}
if (sampleKind !== "maintenance" && !/^[0-9a-f]{40}$/.test(identitySha ?? "")) {
  throw new Error("IDENTITY_SHA must be a 40-character git SHA for probe samples");
}
const effectiveIdentitySha =
  /^[0-9a-f]{40}$/.test(identitySha ?? "") ? identitySha : "0".repeat(40);

const observedAt = new Date().toISOString();
const sample = {
  observedAt,
  identitySha: effectiveIdentitySha,
  maintenance: sampleKind === "maintenance",
  probeStatus: "ok",
  probeError: null,
  ready: null,
  directoryDrift: null,
  outbox: null,
  metrics: null,
  operations: 0,
};

if (sampleKind === "maintenance") {
  sample.probeError = null;
  writeFileSync(samplePath, `${JSON.stringify(sample, null, 2)}\n`);
  console.log("Recorded maintenance soak sample (probes skipped).");
  process.exit(0);
}

function captureProbeError(message) {
  sample.probeStatus = "failed";
  sample.probeError = message;
}

function lastProbeLine(result) {
  const text = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim();
  const lines = text.split("\n").filter(Boolean);
  return lines.at(-1) ?? "";
}

function captureProbeFailure(label, result) {
  const detail = lastProbeLine(result);
  captureProbeError(detail ? `${label}: ${detail}` : `${label} failed`);
}

try {
  const readyResponse = spawnSync(
    "curl",
    ["--fail", "--silent", "--max-time", "15", `${authBase}/health/ready`],
    {
      encoding: "utf8",
    },
  );
  if (readyResponse.status !== 0) {
    captureProbeError(`health/ready failed: ${readyResponse.stderr || readyResponse.stdout}`);
  } else {
    sample.ready = JSON.parse(readyResponse.stdout);
    const release = sample.ready?.release ?? sample.ready?.version ?? "";
    if (release !== effectiveIdentitySha) {
      captureProbeError(`release ${release} != expected ${effectiveIdentitySha}`);
    }
  }

  if (sample.probeStatus === "ok") {
    const drift = spawnSync("pnpm", ["tsx", "scripts/ci/verify-identity-directory-drift.mjs"], {
      encoding: "utf8",
      env: process.env,
    });
    sample.directoryDrift = parseDirectoryDriftLog(`${drift.stdout}\n${drift.stderr}`);
    if (drift.status !== 0) {
      captureProbeFailure("verify-identity-directory-drift", drift);
    }

    const outbox = spawnSync("pnpm", ["tsx", "scripts/ci/verify-identity-outbox-live.mjs"], {
      encoding: "utf8",
      env: process.env,
    });
    sample.outbox = parseOutboxLog(`${outbox.stdout}\n${outbox.stderr}`);
    if (outbox.status !== 0) {
      captureProbeFailure("verify-identity-outbox-live", outbox);
    }

    const metricsResponse = spawnSync(
      "curl",
      [
        "--fail",
        "--silent",
        "--max-time",
        "15",
        "--header",
        `Authorization: Bearer ${process.env.AUTH_METRICS_TOKEN ?? ""}`,
        `${authBase}/metrics`,
      ],
      { encoding: "utf8" },
    );
    if (metricsResponse.status !== 0) {
      captureProbeFailure("metrics scrape", metricsResponse);
    } else {
      sample.metrics = parseAuthSoakMetrics(metricsResponse.stdout);
      sample.operations = sample.metrics.operations;
    }
  }

  if (validationMode === "enforce" && sample.probeStatus === "ok") {
    assertSampleMeetsSoakThresholds(sample);
  }
  if (validationMode === "inject_fail" && sample.probeStatus === "ok") {
    sample.directoryDrift = { ...(sample.directoryDrift ?? {}), orphan: 999 };
    assertSampleMeetsSoakThresholds(sample);
  }
} catch (error) {
  captureProbeError(error instanceof Error ? error.message : String(error));
}

writeFileSync(samplePath, `${JSON.stringify(sample, null, 2)}\n`);
if (sample.probeStatus === "failed" && validationMode === "enforce") {
  console.error(sample.probeError ?? "identity staging soak sample probe failed");
  process.exitCode = 1;
}

function parseDirectoryDriftLog(text) {
  const line = text
    .split("\n")
    .find((entry) => entry.includes("identity directory reconciliation:"));
  if (!line) return null;
  const fields = Object.fromEntries(
    [...line.matchAll(/(\w+)=([^\s]+)/g)].map((match) => [match[1], Number(match[2]) || match[2]]),
  );
  return {
    missing: Number(fields.missing ?? 0),
    orphan: Number(fields.orphan ?? 0),
    mismatched: Number(fields.mismatched ?? 0),
    pendingEvents: Number(fields.pending_events ?? 0),
    maxProcessingLagMs: Number(fields.max_processing_lag_ms ?? 0),
  };
}

function parseOutboxLog(text) {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.oldestPendingMs === "number") {
        return { maxPendingAgeMs: parsed.oldestPendingMs, pendingCount: parsed.pendingCount ?? 0 };
      }
    } catch {
      // ignore non-JSON lines
    }
  }
  return null;
}
