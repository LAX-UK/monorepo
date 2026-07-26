import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

export const e2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
export const e2eSkipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web with seeded credentials.";

type Credentials = {
  email: string;
  password: string;
};

const staffCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_STAFF_EMAIL ?? "admin@lax.bid",
  password: process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "Password123!",
};

const catalogueCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL ?? "",
  password: process.env.PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD ?? "",
};

const buyerCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_BUYER_EMAIL ?? "estate-owner@lax.bid",
  password: process.env.PLAYWRIGHT_BUYER_PASSWORD ?? "Password123!",
};

/** Seeded hybrid saleroom ids — see packages/db dev seed (S.hybridA, L.hybridA1). */
export const seededHybridSaleId =
  process.env.PLAYWRIGHT_HYBRID_SALE_ID ?? "e1000003-0000-4000-8000-000000000003";
export const seededHybridLotId =
  process.env.PLAYWRIGHT_HYBRID_LOT_ID ?? "b1000101-0000-4000-8000-000000000101";

/** Stable seeded ids for visual/detail E2E routes. */
export const seededStaffRoutes = {
  lotDetail: "b1000010-0000-4000-8000-000000000010",
  saleDetail: "e1000001-0000-4000-8000-000000000001",
  submissionDetail: "d2000005-0000-4000-8000-000000000005",
  clientDetail: "90000000-0000-4000-8000-000000000003",
  staffDetail: "90000000-0000-4000-8000-000000000001",
  legalEntityDetail: "10000000-0000-4000-8000-000000000003",
  sofCaseDetail: "92000003-0000-4000-8000-000000000003",
  categoryDetail: "c1000001-0000-4000-8000-000000000001",
  artistDetail: "a1000001-0000-4000-8000-000000000001",
  eventRsvpSlug: "lax001",
  legalEntityDrawer: "10000000-0000-4000-8000-000000000003",
  invitationDrawer: "i1000001-0000-4000-8000-000000000001",
} as const;

async function dismissCookieConsentIfVisible(page: Page): Promise<void> {
  const acceptCookies = page.getByRole("button", { name: /accept all/i });
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click();
  }
}

async function login(page: Page, credentials: Credentials): Promise<void> {
  const loginUrl = `/login?email=${encodeURIComponent(credentials.email)}`;
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await dismissCookieConsentIfVisible(page);

  const continueAuthed = page.getByRole("link", { name: /^continue$/i });
  const password = page.locator('input[name="password"]').first();
  const rateLimited = page.getByText(/too many requests|rate.?limited/i);

  await Promise.race([
    continueAuthed.waitFor({ state: "visible", timeout: 20_000 }),
    password.waitFor({ state: "visible", timeout: 20_000 }),
    rateLimited.waitFor({ state: "visible", timeout: 20_000 }),
  ]).catch(() => {
    /* fall through — one branch should become visible */
  });

  if (await rateLimited.isVisible().catch(() => false)) {
    throw new Error(
      "Sign-in rate limited during Playwright login. Clear rl:auth:signin:* in Redis and retry.",
    );
  }

  if (await continueAuthed.isVisible().catch(() => false)) {
    await continueAuthed.click();
    await page.waitForURL(/\/(admin|dashboard)/, {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });
    await assertAuthenticatedStaffSession(page);
    return;
  }

  await password.waitFor({ state: "visible", timeout: 20_000 });
  await password.click();
  await password.fill(credentials.password);
  const submit = page.getByRole("button", { name: /^sign in$/i });
  await Promise.all([
    page.waitForURL(/\/(admin|dashboard)/, {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    }),
    (async () => {
      if (await submit.isVisible().catch(() => false)) {
        await submit.click();
        return;
      }
      await page
        .locator("form")
        .first()
        .evaluate((form) => (form as HTMLFormElement).requestSubmit());
    })(),
  ]);
  await assertAuthenticatedStaffSession(page);
}

/** Fails fast when auth cookies were not seeded — avoids login-page PNG corruption. */
export async function assertAuthenticatedStaffSession(page: Page): Promise<void> {
  const onLogin = /\/login(?:\?|$)/.test(page.url());
  const main = page.locator("#main-content");
  const loginPassword = page.locator('input[name="password"]').first();
  if (onLogin || (await loginPassword.isVisible().catch(() => false))) {
    throw new Error(`Expected authenticated staff session but landed on login (${page.url()}).`);
  }
  await expect(main).toBeVisible({ timeout: 15_000 });
}

export function hasStaffCredentials(): boolean {
  return Boolean(staffCredentials.email && staffCredentials.password);
}

export function hasCatalogueManagerCredentials(): boolean {
  return Boolean(catalogueCredentials.email && catalogueCredentials.password);
}

export function hasBuyerCredentials(): boolean {
  return Boolean(buyerCredentials.email && buyerCredentials.password);
}

export async function staffLogin(page: Page): Promise<void> {
  await login(page, staffCredentials);
}

/** Re-authenticates when a long visual run loses cookies mid-suite. */
export async function ensureAuthenticatedStaffSession(page: Page): Promise<void> {
  const onLogin = /\/login(?:\?|$)/.test(page.url());
  const loginPassword = page.locator('input[name="password"]').first();
  if (!(onLogin || (await loginPassword.isVisible().catch(() => false)))) {
    await assertAuthenticatedStaffSession(page);
    return;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (attempt > 1) {
        clearAuthSignInRateLimits();
        await page.waitForTimeout(2_000);
      } else {
        clearAuthSignInRateLimits();
      }
      await staffLogin(page);
      await assertAuthenticatedStaffSession(page);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Clears Better Auth sign-in rate-limit keys (docker compose redis). */
export function clearAuthSignInRateLimits(): void {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const result = spawnSync(
    "docker",
    ["compose", "exec", "-T", "redis", "redis-cli", "--scan", "--pattern", "rl:auth:signin:*"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status !== 0) return;
  const keys = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (keys.length === 0) return;
  spawnSync("docker", ["compose", "exec", "-T", "redis", "redis-cli", "DEL", ...keys], {
    cwd: repoRoot,
    stdio: "ignore",
  });
}

export async function catalogueManagerLogin(page: Page): Promise<void> {
  await login(page, catalogueCredentials);
}

export async function buyerLogin(page: Page): Promise<void> {
  await login(page, buyerCredentials);
}

export function formatAxeViolations(
  violations: ReadonlyArray<{ id: string; impact?: string | null; help: string }>,
): string {
  return violations
    .map((violation) => `  - ${violation.id} (${violation.impact ?? "?"}): ${violation.help}`)
    .join("\n");
}

export async function expectNoSeriousAxeViolationsInMain(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .include("#main-content")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = result.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
  const details = formatAxeViolations(blocking);
  expect(blocking, blocking.length > 0 ? `Axe violations:\n${details}` : undefined).toHaveLength(0);
}

export async function stabilizeVisualPage(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
}
