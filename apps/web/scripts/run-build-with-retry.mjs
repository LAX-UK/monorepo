#!/usr/bin/env node
/**
 * Web production build wrapper. next/font/google can fail when fonts.googleapis.com
 * returns a non-CSS body (see apps/web/Dockerfile). Retry in CI; fail fast locally.
 */
import { spawnSync } from "node:child_process";

const defaultAttempts = process.env.CI ? 3 : 1;
const attempts = Number(process.env.WEB_BUILD_RETRY_ATTEMPTS ?? defaultAttempts);
const delaySec = Number(process.env.WEB_BUILD_RETRY_DELAY_SEC ?? 15);

if (!Number.isFinite(attempts) || attempts < 1) {
  throw new Error("WEB_BUILD_RETRY_ATTEMPTS must be a positive integer");
}

function sleep(seconds) {
  spawnSync("sleep", [String(seconds)], { stdio: "inherit" });
}

let lastStatus = 1;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const result = spawnSync("pnpm", ["exec", "next", "build"], {
    stdio: "inherit",
    env: process.env,
  });
  lastStatus = result.status ?? 1;
  if (lastStatus === 0) {
    process.exit(0);
  }
  if (attempt < attempts) {
    console.warn(`Web build failed (attempt ${attempt}/${attempts}); retrying in ${delaySec}s...`);
    sleep(delaySec);
  }
}

process.exit(lastStatus);
