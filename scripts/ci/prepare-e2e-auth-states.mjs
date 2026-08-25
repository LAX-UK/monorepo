#!/usr/bin/env node
/**
 * Creates independent Playwright storage-state files for each PR-gate role.
 * Sign-in goes through a Playwright browser context so Chromium stores the
 * cookies (API-only Set-Cookie writes are not attached on localhost).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  cookieHeaderFromStorageState,
  e2eAuthEndpoints,
  formatProbeFailure,
  probeSession,
  writeProbeReport,
} from "./e2e-session-state.mjs";

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

async function loadChromium() {
  try {
    return (await import("@playwright/test")).chromium;
  } catch {
    const fallback = path.join(root, "apps/web/node_modules/@playwright/test/index.js");
    return (await import(pathToFileURL(fallback).href)).chromium;
  }
}

function hasSessionToken(state) {
  return (state.cookies ?? []).some((cookie) => /session_token/.test(cookie.name));
}

const { webOrigin, authUrl } = e2eAuthEndpoints();
const chromium = await loadChromium();
const browser = await chromium.launch();
const probes = [];

try {
  for (const target of roles) {
    if (!target.email || !target.password) {
      console.log(`skip ${target.role}: credentials not set`);
      continue;
    }
    flushRateLimits();
    const context = await browser.newContext();
    const login = await context.request.post(`${authUrl}/api/auth/sign-in/email`, {
      headers: { "content-type": "application/json", origin: webOrigin },
      data: { email: target.email, password: target.password },
    });
    if (!login.ok()) {
      const detail = await login.text();
      await context.close();
      throw new Error(
        `sign-in for ${target.role} failed: ${login.status()} ${detail.slice(0, 200)}`.trim(),
      );
    }
    await context.storageState({ path: target.outPath });
    await context.close();
    const state = JSON.parse(readFileSync(target.outPath, "utf8"));
    if (!hasSessionToken(state)) {
      throw new Error(`sign-in for ${target.role} did not persist a session_token cookie`);
    }
    const probe = await probeSession({ cookie: cookieHeaderFromStorageState(state) });
    if (!probe.authenticated) {
      throw new Error(formatProbeFailure(target.role, target.outPath, probe));
    }
    probes.push({
      role: target.role,
      authenticated: probe.authenticated,
      authStatus: probe.authStatus,
      meStatus: probe.meStatus,
      email: probe.email,
      cookieNames: probe.cookieNames,
      cookieDomain: state.cookies[0]?.domain ?? null,
      cookieCount: state.cookies.length,
    });
    console.log(
      `minted ${target.role} session get-session=${probe.authStatus} /users/me=${probe.meStatus}`,
    );
  }
} finally {
  await browser.close();
}

flushRateLimits();
const reportPath = path.join(authDir, "session-probe.json");
writeProbeReport({ generatedAt: new Date().toISOString(), probes }, reportPath);
console.log(`wrote ${reportPath}`);
