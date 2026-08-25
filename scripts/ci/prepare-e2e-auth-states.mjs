#!/usr/bin/env node
/**
 * Creates independent Playwright storage-state files via the browser login
 * journey. Chromium must store the cookies; API-only Set-Cookie JSON is not
 * attached on localhost (tests then see only `lax_theme`).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probeStorageStateFile, writeProbeReport } from "./e2e-session-state.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webDir = path.join(root, "apps/web");
const authDir = path.join(webDir, "e2e/.auth");

const setupProjects = [
  "setup-staff",
  "setup-finance",
  "setup-readonly",
  "setup-operations",
  "setup-buyer",
  ...(process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL &&
  process.env.PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD
    ? ["setup-catalogue"]
    : []),
];

const expectedFiles = [
  ["staff", path.join(authDir, "staff.json")],
  ["staffRoles", path.join(authDir, "staff-roles.json")],
  ["staffPublic", path.join(authDir, "staff-public.json")],
  ["finance", path.join(authDir, "finance.json")],
  ["readonlyStaff", path.join(authDir, "readonly-staff.json")],
  ["operations", path.join(authDir, "operations.json")],
  ["buyer", path.join(authDir, "buyer.json")],
  ...(process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL
    ? [["catalogueManager", path.join(authDir, "catalogue-manager.json")]]
    : []),
];

function flushRateLimits() {
  const result = spawnSync("node", [path.join(root, "scripts/ci/flush-auth-rate-limits.mjs")], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("failed to flush auth rate-limit keys");
  }
}

function forceHttpCookies(filePath) {
  const state = JSON.parse(readFileSync(filePath, "utf8"));
  for (const cookie of state.cookies ?? []) {
    cookie.secure = false;
    if (!cookie.path) cookie.path = "/";
    if (typeof cookie.domain === "string") cookie.domain = cookie.domain.replace(/^\./, "");
  }
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

function cookieMeta(filePath) {
  const state = JSON.parse(readFileSync(filePath, "utf8"));
  return (state.cookies ?? []).map((cookie) => ({
    name: cookie.name,
    domain: cookie.domain ?? null,
    path: cookie.path ?? null,
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: cookie.sameSite ?? null,
    expires: cookie.expires ?? null,
  }));
}

for (const project of setupProjects) {
  flushRateLimits();
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "e2e/auth.setup.ts", `--project=${project}`],
    {
      cwd: webDir,
      stdio: "inherit",
      env: { ...process.env, PLAYWRIGHT_E2E: "1" },
    },
  );
  if (result.status !== 0) {
    throw new Error(`Playwright ${project} failed`);
  }
}

flushRateLimits();
const probes = [];
for (const [role, filePath] of expectedFiles) {
  if (!existsSync(filePath)) {
    throw new Error(`expected auth state ${role} was not written to ${filePath}`);
  }
  forceHttpCookies(filePath);
  const meta = cookieMeta(filePath);
  if (!meta.some((cookie) => /session_token/.test(cookie.name))) {
    throw new Error(`${role} storage state has no session_token (${filePath})`);
  }
  const probe = await probeStorageStateFile(filePath);
  if (!probe.authenticated) {
    throw new Error(
      `${role} cookie did not authenticate get-session=${probe.authStatus} /users/me=${probe.meStatus}`,
    );
  }
  probes.push({
    role,
    authenticated: probe.authenticated,
    authStatus: probe.authStatus,
    meStatus: probe.meStatus,
    email: probe.email,
    cookies: meta,
  });
  console.log(
    `verified ${role} session get-session=${probe.authStatus} /users/me=${probe.meStatus}`,
  );
}

flushRateLimits();
const reportPath = path.join(authDir, "session-probe.json");
writeProbeReport({ generatedAt: new Date().toISOString(), probes }, reportPath);
console.log(`wrote ${reportPath}`);
