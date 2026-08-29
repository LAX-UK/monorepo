#!/usr/bin/env node
/**
 * Start the production-built Bid web app the same way Docker does.
 * Standalone output requires copying static assets before `server.js` can serve them.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webRoot = path.join(root, "apps/web");
const standaloneRoot = path.join(webRoot, ".next/standalone/apps/web");
const server = path.join(standaloneRoot, "server.js");

if (!existsSync(server)) {
  console.error(
    `Missing standalone web server at ${server}. Run pnpm --filter @auction/web build first.`,
  );
  process.exit(1);
}

function syncStandaloneAssets(label, source, target) {
  if (!existsSync(source)) {
    console.error(`Missing ${label} at ${source}. Run pnpm --filter @auction/web build first.`);
    process.exit(1);
  }
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

syncStandaloneAssets(
  "Next static assets",
  path.join(webRoot, ".next/static"),
  path.join(standaloneRoot, ".next/static"),
);
syncStandaloneAssets(
  "public assets",
  path.join(webRoot, "public"),
  path.join(standaloneRoot, "public"),
);

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  cwd: path.join(webRoot, ".next/standalone"),
  env: {
    ...process.env,
    PORT: process.env.PORT ?? "3000",
    HOSTNAME: process.env.HOSTNAME ?? "0.0.0.0",
    ALLOW_HTTP_COOKIES: process.env.ALLOW_HTTP_COOKIES ?? "true",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
