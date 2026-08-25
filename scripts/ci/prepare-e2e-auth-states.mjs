#!/usr/bin/env node
/**
 * Creates independent Playwright storage-state files for each PR-gate role.
 * Staff consumers get separate sessions so parallel workers cannot rotate
 * or invalidate one shared cookie.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mintRoleAuthState, writeProbeReport } from "./e2e-session-state.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const authDir = path.join(root, "apps/web/e2e/.auth");

const roles = [
  {
    role: "staff",
    email: process.env.PLAYWRIGHT_STAFF_EMAIL ?? "admin@lax.bid",
    password: process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "Password123!",
    outPath: path.join(authDir, "staff.json"),
  },
  {
    role: "staffRoles",
    email: process.env.PLAYWRIGHT_STAFF_EMAIL ?? "admin@lax.bid",
    password: process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "Password123!",
    outPath: path.join(authDir, "staff-roles.json"),
  },
  {
    role: "staffPublic",
    email: process.env.PLAYWRIGHT_STAFF_EMAIL ?? "admin@lax.bid",
    password: process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "Password123!",
    outPath: path.join(authDir, "staff-public.json"),
  },
  {
    role: "finance",
    email: process.env.PLAYWRIGHT_FINANCE_EMAIL ?? "accountant@lax.bid",
    password: process.env.PLAYWRIGHT_FINANCE_PASSWORD ?? "Password123!",
    outPath: path.join(authDir, "finance.json"),
  },
  {
    role: "readonlyStaff",
    email: process.env.PLAYWRIGHT_READONLY_EMAIL ?? "staff-readonly@lax.bid",
    password: process.env.PLAYWRIGHT_READONLY_PASSWORD ?? "Password123!",
    outPath: path.join(authDir, "readonly-staff.json"),
  },
  {
    role: "operations",
    email: process.env.PLAYWRIGHT_OPERATIONS_EMAIL ?? "staff-operations@lax.bid",
    password: process.env.PLAYWRIGHT_OPERATIONS_PASSWORD ?? "Password123!",
    outPath: path.join(authDir, "operations.json"),
  },
  {
    role: "buyer",
    email: process.env.PLAYWRIGHT_BUYER_EMAIL ?? "estate-owner@lax.bid",
    password: process.env.PLAYWRIGHT_BUYER_PASSWORD ?? "Password123!",
    outPath: path.join(authDir, "buyer.json"),
  },
  {
    role: "catalogueManager",
    email: process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL ?? "",
    password: process.env.PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD ?? "",
    outPath: path.join(authDir, "catalogue-manager.json"),
  },
];

function flushRateLimits() {
  const result = spawnSync("node", [path.join(root, "scripts/ci/flush-auth-rate-limits.mjs")], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("failed to flush auth rate-limit keys before minting a session");
  }
}

const probes = [];
for (const target of roles) {
  if (!target.email || !target.password) {
    console.log(`skip ${target.role}: credentials not set`);
    continue;
  }
  flushRateLimits();
  const probe = await mintRoleAuthState(target);
  probes.push({
    role: target.role,
    authenticated: probe.authenticated,
    authStatus: probe.authStatus,
    meStatus: probe.meStatus,
    email: probe.email,
    cookieNames: probe.cookieNames,
    cookieDomain: probe.cookieDomain,
    cookieCount: probe.cookieCount,
  });
  console.log(
    `minted ${target.role} session get-session=${probe.authStatus} /users/me=${probe.meStatus}`,
  );
}

const reportPath = path.join(authDir, "session-probe.json");
writeProbeReport(
  {
    generatedAt: new Date().toISOString(),
    probes,
  },
  reportPath,
);
console.log(`wrote ${reportPath}`);
