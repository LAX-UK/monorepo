#!/usr/bin/env node
/**
 * Web production build wrapper. next/font/google can fail when fonts.googleapis.com
 * returns a non-CSS body (see apps/web/Dockerfile). Retry only on font-fetch errors in CI.
 */
import { spawnSync } from "node:child_process";

const defaultAttempts = process.env.CI ? 3 : 1;
const attempts = Number(process.env.WEB_BUILD_RETRY_ATTEMPTS ?? defaultAttempts);
const delaySec = Number(process.env.WEB_BUILD_RETRY_DELAY_SEC ?? 15);

if (!Number.isFinite(attempts) || attempts < 1) {
  throw new Error("WEB_BUILD_RETRY_ATTEMPTS must be a positive integer");
}

const FONT_FETCH_PATTERNS = [
  /fonts\.googleapis\.com/i,
  /next\/font\/google/i,
  /An error occurred in `next\/font`/i,
  /Failed to fetch font/i,
  /Failed to download font/i,
  /Cannot read properties of null \(reading '1'\)/,
];

function sleep(seconds) {
  spawnSync("sleep", [String(seconds)], { stdio: "inherit" });
}

function looksLikeFontFetchFailure(output) {
  return FONT_FETCH_PATTERNS.some((pattern) => pattern.test(output));
}

let lastStatus = 1;
let lastOutput = "";
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const result = spawnSync("pnpm", ["exec", "next", "build"], {
    encoding: "utf8",
    env: process.env,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  lastOutput = `${stdout}\n${stderr}`;
  lastStatus = result.status ?? 1;
  if (lastStatus === 0) {
    process.exit(0);
  }
  const retryable = process.env.CI && looksLikeFontFetchFailure(lastOutput);
  if (!retryable || attempt >= attempts) {
    break;
  }
  console.warn(
    `Web build failed with a font fetch error (attempt ${attempt}/${attempts}); retrying in ${delaySec}s...`,
  );
  sleep(delaySec);
}

process.exit(lastStatus);
