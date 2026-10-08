#!/usr/bin/env node
/**
 * Update image tags on selected App Platform components (App Platform starts one deployment).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAppSpec } from "./assert-app-platform-spec.mjs";

const SHA = /^[0-9a-f]{40}$/;

function parseArgs(argv) {
  let appId = "";
  let tagMapJson = "{}";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app-id") appId = argv[++i] ?? "";
    if (argv[i] === "--tags") tagMapJson = argv[++i] ?? "{}";
  }
  if (!appId) throw new Error("--app-id is required");
  const tagMap = JSON.parse(tagMapJson);
  for (const [name, tag] of Object.entries(tagMap)) {
    if (!SHA.test(tag)) {
      throw new Error(`Tag for ${name} must be a 40-char SHA (got ${tag})`);
    }
  }
  return { appId, tagMap };
}

export function applyTagMapToSpec(spec, tagMap) {
  const next = structuredClone(spec);
  for (const kind of ["services", "workers", "jobs"]) {
    for (const entry of next[kind] ?? []) {
      const desired = tagMap[entry.name];
      if (desired && entry.image) {
        entry.image.tag = desired;
      }
    }
  }
  return next;
}

/** @param {string} stdout doctl apps update --output json */
export function deploymentIdFromAppsUpdate(stdout) {
  const payload = JSON.parse(stdout);
  const app = Array.isArray(payload) ? payload[0] : payload;
  const id =
    app?.pending_deployment?.id ?? app?.in_progress_deployment?.id ?? app?.active_deployment?.id;
  if (!id) {
    throw new Error("Missing deployment id from apps update response");
  }
  return id;
}

function main() {
  const { appId, tagMap } = parseArgs(process.argv.slice(2));
  const spec = readAppSpec(appId);
  const patched = applyTagMapToSpec(spec, tagMap);
  const dir = mkdtempSync(join(tmpdir(), "do-app-spec-"));
  const specPath = join(dir, "spec.json");
  writeFileSync(specPath, JSON.stringify(patched, null, 2));

  const update = spawnSync(
    "doctl",
    ["apps", "update", appId, "--spec", specPath, "--output", "json"],
    {
      encoding: "utf8",
    },
  );
  if (update.status !== 0) {
    throw new Error(update.stderr || update.stdout || "doctl apps update failed");
  }
  process.stdout.write(`${deploymentIdFromAppsUpdate(update.stdout)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
