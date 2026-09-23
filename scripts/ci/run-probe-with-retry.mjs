#!/usr/bin/env node
/**
 * Bounded retry for network-bound staging acceptance probes. Contract tests and
 * static assertions should be invoked directly (no retry).
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: run-probe-with-retry.mjs <command> [args...]");
  process.exit(2);
}

const attempts = Number(process.env.IDENTITY_PROBE_RETRY_ATTEMPTS ?? 2);
const delaySec = Number(process.env.IDENTITY_PROBE_RETRY_DELAY_SEC ?? 5);

if (!Number.isFinite(attempts) || attempts < 1) {
  throw new Error("IDENTITY_PROBE_RETRY_ATTEMPTS must be a positive integer");
}

function sleep(seconds) {
  spawnSync("sleep", [String(seconds)], { stdio: "inherit" });
}

let lastStatus = 1;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const [command, ...commandArgs] = args;
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  lastStatus = result.status ?? 1;
  if (lastStatus === 0) {
    process.exit(0);
  }
  if (attempt < attempts) {
    console.warn(`Probe failed (attempt ${attempt}/${attempts}); retrying in ${delaySec}s...`);
    sleep(delaySec);
  }
}

process.exit(lastStatus);
