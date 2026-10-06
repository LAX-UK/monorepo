#!/usr/bin/env node
/**
 * Local stack uses SHOP_LOCAL_STACK=1 (no Turbopack) — Turbopack dev has been observed
 * to hang after the first full SSR of /. Default dev keeps --turbopack for speed.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const shopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localStack = process.env.SHOP_LOCAL_STACK === "1";
const args = ["dev", "--port", "3020"];
if (!localStack) {
  args.push("--turbopack");
} else {
  console.info("[shop] Local stack dev (webpack; SHOP_LOCAL_STACK=1, no --turbopack)");
}

const child = spawn("next", args, {
  cwd: shopRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
