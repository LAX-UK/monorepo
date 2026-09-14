#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSampleMeetsSoakThresholds } from "./identity-soak-threshold-contract.mjs";

const token = process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY ?? "LAX-UK/monorepo";
const identitySha = process.env.IDENTITY_SHA;
const soakStartedAt = process.env.SOAK_STARTED_AT;
const minimumOperations = Number(process.env.MINIMUM_OPERATIONS ?? "1");
const outputPath = join(process.env.RUNNER_TEMP ?? tmpdir(), "identity-soak-evaluation.json");

if (!token || !/^[0-9a-f]{40}$/.test(identitySha ?? "")) {
  throw new Error("GH_TOKEN and a valid IDENTITY_SHA are required");
}
const startedAt = Date.parse(soakStartedAt ?? "");
if (!Number.isFinite(startedAt)) {
  throw new Error("SOAK_STARTED_AT must be a valid UTC timestamp");
}
const elapsedMs = Date.now() - startedAt;
if (elapsedMs < 24 * 60 * 60 * 1000) {
  throw new Error("The soak evaluator cannot pass before 24 hours have elapsed");
}

const headers = {
  accept: "application/vnd.github+json",
  authorization: `Bearer ${token}`,
  "x-github-api-version": "2022-11-28",
};

async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function downloadSample(artifact) {
  const response = await fetch(artifact.archive_download_url, {
    headers,
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Artifact ${artifact.id} download failed (${response.status})`);
  }
  const directory = mkdtempSync(join(tmpdir(), "identity-soak-"));
  const archive = join(directory, "sample.zip");
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  const unzip = spawnSync("unzip", ["-oq", archive, "-d", directory], {
    encoding: "utf8",
  });
  if (unzip.status !== 0) throw new Error(unzip.stderr || "Failed to unzip soak sample");
  return JSON.parse(readFileSync(join(directory, "soak-sample.json"), "utf8"));
}

const artifacts = [];
for (let page = 1; ; page += 1) {
  const result = await github(`/actions/artifacts?per_page=100&page=${page}`);
  const matches = result.artifacts.filter(
    (artifact) =>
      !artifact.expired &&
      artifact.name.startsWith("identity-staging-soak-sample-") &&
      Date.parse(artifact.created_at) >= startedAt,
  );
  artifacts.push(...matches);
  if (result.artifacts.length < 100) break;
}

const samples = (await Promise.all(artifacts.map(downloadSample)))
  .filter((sample) => sample.identitySha === identitySha)
  .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));

if (samples.length < 96) {
  throw new Error(`Expected at least 96 soak samples; found ${samples.length}`);
}
for (let index = 1; index < samples.length; index += 1) {
  const gap = Date.parse(samples[index].observedAt) - Date.parse(samples[index - 1].observedAt);
  if (gap > 25 * 60 * 1000) {
    throw new Error(`Soak sample gap exceeded 25 minutes at ${samples[index].observedAt}`);
  }
}

const firstOperations = Number(samples[0].operations);
const lastOperations = Number(samples.at(-1).operations);
const operationDelta = lastOperations - firstOperations;
if (!Number.isFinite(operationDelta) || operationDelta < minimumOperations) {
  throw new Error(`Observed Auth operation delta ${operationDelta} is below ${minimumOperations}`);
}
for (const sample of samples) {
  if (sample.probeStatus === "failed") {
    throw new Error(
      `Soak sample at ${sample.observedAt} failed: ${sample.probeError ?? "unknown"}`,
    );
  }
  assertSampleMeetsSoakThresholds(sample);
}

writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      identitySha,
      soakStartedAt,
      evaluatedAt: new Date().toISOString(),
      sampleCount: samples.length,
      operationDelta,
      maximumAllowedGapMinutes: 25,
      result: "pass",
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Identity soak passed with ${samples.length} samples and ${operationDelta} operations.`,
);
