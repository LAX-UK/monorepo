#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { resolveSoakWindow } from "./identity-soak-window.mjs";
import { listGithubSoakArtifacts } from "./list-github-soak-artifacts.mjs";

const repository = process.env.GITHUB_REPOSITORY ?? "LAX-UK/monorepo";
const token = process.env.GH_TOKEN;
const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");
const identityShaOverride = process.env.IDENTITY_SHA;
const soakStartedAtOverride = process.env.SOAK_STARTED_AT;

if (!token) {
  throw new Error("GH_TOKEN is required");
}

async function loadLiveIdentitySha() {
  if (/^[0-9a-f]{40}$/.test(identityShaOverride ?? "")) {
    return identityShaOverride;
  }
  const response = await fetch(`${authBase}/health/ready`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`health/ready failed (${response.status})`);
  }
  const body = await response.json();
  const release = String(body.release ?? body.version ?? "").trim();
  if (!/^[0-9a-f]{40}$/.test(release)) {
    throw new Error(`Invalid Identity release SHA: ${release || "(missing)"}`);
  }
  return release;
}

const liveSha = await loadLiveIdentitySha();
let startedMs = Number.isFinite(Date.parse(soakStartedAtOverride ?? ""))
  ? Date.parse(soakStartedAtOverride)
  : Number.NaN;

if (!Number.isFinite(startedMs)) {
  const artifacts = await listGithubSoakArtifacts({ token, repository });
  const window = resolveSoakWindow({ liveSha, artifacts });
  if (!window) {
    startedMs = Date.now();
  } else {
    startedMs = window.startedMs;
  }
}

const payload = {
  identity_sha: liveSha,
  soak_started_at: new Date(startedMs).toISOString(),
};
const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) {
  appendFileSync(outputPath, `identity_sha=${payload.identity_sha}\n`);
  appendFileSync(outputPath, `soak_started_at=${payload.soak_started_at}\n`);
}
console.log(JSON.stringify(payload));
