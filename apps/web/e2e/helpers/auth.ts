import AxeBuilder from "@axe-core/playwright";
import { type Page, type Response, expect } from "@playwright/test";

export const e2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
export const e2eSkipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web with seeded credentials.";

export type Credentials = {
  email: string;
  password: string;
};

type LoginOptions = {
  destination?: RegExp;
};

const staffCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_STAFF_EMAIL ?? "admin@lax.bid",
  password: process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "Password123!",
};

const catalogueCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL ?? "",
  password: process.env.PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD ?? "",
};

const financeCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_FINANCE_EMAIL ?? "accountant@lax.bid",
  password: process.env.PLAYWRIGHT_FINANCE_PASSWORD ?? "Password123!",
};

const readonlyCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_READONLY_EMAIL ?? "staff-readonly@lax.bid",
  password: process.env.PLAYWRIGHT_READONLY_PASSWORD ?? "Password123!",
};

const operationsCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_OPERATIONS_EMAIL ?? "staff-operations@lax.bid",
  password: process.env.PLAYWRIGHT_OPERATIONS_PASSWORD ?? "Password123!",
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
  venueDetail: "01000001-0000-4000-8000-000000000001",
  eventRsvpSlug: "lax001",
  legalEntityDrawer: "10000000-0000-4000-8000-000000000003",
  invitationDrawer: "01100001-0000-4000-8000-000000000001",
} as const;

/** Closes the staff command palette when storage state auto-opens it on navigation. */
export async function dismissStaffPaletteIfOpen(page: Page): Promise<void> {
  // Title is sr-only, so heading.isVisible() stays false while the dialog is open.
  const palette = page.getByRole("dialog", { name: /quick go/i });
  if ((await palette.count()) === 0) return;

  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await palette.count()) === 0) return;
    await page.keyboard.press("Escape");
    const closed = await palette
      .waitFor({ state: "hidden", timeout: 2_000 })
      .then(() => true)
      .catch(() => false);
    if (closed || (await palette.count()) === 0) return;
    const closeButton = palette.getByRole("button", { name: /^close$/i });
    if ((await closeButton.count()) > 0) {
      await closeButton.click();
    }
  }
}

async function dismissCookieConsentIfVisible(page: Page): Promise<void> {
  const acceptCookies = page.getByRole("button", { name: /accept all/i });
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click();
    await acceptCookies.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
}

/** Navigate to a staff path, resuming the stored session when the edge sends login. */
export async function gotoAdminPath(page: Page, path: string): Promise<Response | null> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  if (/\/login(?:\?|$)/.test(page.url())) {
    await staffLogin(page);
    return page.goto(path, { waitUntil: "domcontentloaded" });
  }
  return response;
}

/** Dev servers often never reach `load`; prefer domcontentloaded for staff navigation. */
export async function gotoStaffPage(
  page: Page,
  path: string,
  options?: { waitUntil?: "domcontentloaded" | "load" },
): Promise<Response | null> {
  return page.goto(path, { waitUntil: options?.waitUntil ?? "domcontentloaded" });
}

async function readLoginBannerErrors(page: Page): Promise<string> {
  if (page.isClosed()) return "";
  const bannerError = await page
    .locator('[role="alert"], output[aria-live="polite"]')
    .allTextContents()
    .catch(() => [] as string[]);
  return bannerError.filter(Boolean).join(" · ");
}

async function resumeIfAlreadySignedIn(page: Page, destination: RegExp): Promise<boolean> {
  const continueLink = page.getByRole("link", { name: /^continue(?: to dashboard)?$/i }).first();
  const signedIn = page.locator("output").filter({ hasText: /signed in/i });
  if ((await signedIn.count()) === 0 && !(await continueLink.isVisible().catch(() => false))) {
    return false;
  }
  if (!(await continueLink.isVisible().catch(() => false))) return false;
  await continueLink.click();
  await page.waitForURL(destination, {
    timeout: 60_000,
    waitUntil: "domcontentloaded",
  });
  return true;
}

async function login(
  page: Page,
  credentials: Credentials,
  options: LoginOptions = {},
): Promise<void> {
  const destination = options.destination ?? /\/(admin|dashboard)/;
  const loginUrl = `/login?email=${encodeURIComponent(credentials.email)}`;
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await dismissCookieConsentIfVisible(page);
  await Promise.race([
    page
      .locator("output")
      .filter({ hasText: /signed in/i })
      .waitFor({ state: "visible", timeout: 8_000 }),
    page.locator('input[name="password"]').first().waitFor({ state: "visible", timeout: 8_000 }),
    page.getByRole("button", { name: /^continue$/i }).waitFor({ state: "visible", timeout: 8_000 }),
  ]).catch(() => {});
  if (await resumeIfAlreadySignedIn(page, destination)) return;

  const serverError = page.getByText(/internal server error/i);
  if (await serverError.isVisible().catch(() => false)) {
    throw new Error(
      "Login page returned Internal Server Error — restart apps/web (dev .next may be stale after pnpm build).",
    );
  }

  const continueAuthed = page.getByRole("link", { name: /^continue(?: to dashboard)?$/i });
  const alreadySignedIn = page.getByText(/already signed in/i);
  const continueToCredentials = page.getByRole("button", { name: /^continue$/i });
  const password = page
    .locator('input[name="password"], input[autocomplete="current-password"]')
    .first();
  const rateLimited = page.getByText(/too many requests|rate.?limited|too many attempts/i);

  await Promise.race([
    continueAuthed.waitFor({ state: "visible", timeout: 20_000 }),
    alreadySignedIn.waitFor({ state: "visible", timeout: 20_000 }),
    continueToCredentials.waitFor({ state: "visible", timeout: 20_000 }),
    password.waitFor({ state: "visible", timeout: 20_000 }),
    rateLimited.waitFor({ state: "visible", timeout: 20_000 }),
  ]).catch(() => {
    /* fall through — one branch should become visible */
  });

  if (await rateLimited.isVisible().catch(() => false)) {
    throw new Error(
      "Sign-in rate limited during Playwright setup. Start with a clean test Redis instance and retry.",
    );
  }

  if (
    (await continueAuthed.isVisible().catch(() => false)) ||
    (await alreadySignedIn.isVisible().catch(() => false))
  ) {
    await continueAuthed.first().click();
    await page.waitForURL(destination, {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });
    return;
  }

  if (await continueToCredentials.isVisible().catch(() => false)) {
    await continueToCredentials.click();
  }

  await password.waitFor({ state: "visible", timeout: 20_000 });
  await password.click();
  await password.fill(credentials.password);
  const submit = page.getByRole("button", { name: /^sign in$/i });
  await Promise.all([
    page.waitForURL(destination, {
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
  ]).catch(async (error) => {
    if (await resumeIfAlreadySignedIn(page, destination)) return;
    const detail = await readLoginBannerErrors(page);
    throw new Error(
      detail
        ? `Sign-in did not redirect (${page.url()}). ${detail}`
        : `Sign-in did not redirect (${page.url()}). ${String(error)}`,
    );
  });
}

/** Sign in with a named seeded fixture without duplicating the login journey in specs. */
export async function loginWithCredentials(
  page: Page,
  credentials: Credentials,
  options?: LoginOptions,
): Promise<void> {
  await login(page, credentials, options);
}

/** Fails fast when auth cookies were not seeded — avoids login-page PNG corruption. */
export async function assertAuthenticatedStaffSession(page: Page): Promise<void> {
  const onLogin = /\/login(?:\?|$)/.test(page.url());
  const loginPassword = page.locator('input[name="password"]').first();
  if (onLogin || (await loginPassword.isVisible().catch(() => false))) {
    throw new Error(`Expected authenticated staff session but landed on login (${page.url()}).`);
  }

  const admin404 = page.getByRole("heading", { name: /that admin route doesn't exist/i });
  if (await admin404.isVisible().catch(() => false)) {
    throw new Error(`Expected authenticated staff route but landed on admin 404 (${page.url()}).`);
  }

  const main = page.locator("#main-content");
  await expect(main).toBeVisible({ timeout: 15_000 });

  // Palette and preview sheets aria-hide the sidebar/account menu; close the
  // palette only. A visible main region on a non-login admin URL is enough.
  await dismissStaffPaletteIfOpen(page);
}

/** Rejects admin error/404 shells before visual capture. */
export async function assertAdminRouteReady(page: Page): Promise<void> {
  await assertAuthenticatedStaffSession(page);

  const admin404 = page.getByRole("heading", { name: /that admin route doesn't exist/i });
  await expect(admin404).toHaveCount(0);

  const generic404 = page.getByText(/^404\b/i);
  if (await generic404.isVisible().catch(() => false)) {
    throw new Error(`Admin route returned 404 before capture (${page.url()}).`);
  }
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

export function hasFinanceCredentials(): boolean {
  return Boolean(financeCredentials.email && financeCredentials.password);
}

export function hasReadonlyCredentials(): boolean {
  return Boolean(readonlyCredentials.email && readonlyCredentials.password);
}

export function hasOperationsCredentials(): boolean {
  return Boolean(operationsCredentials.email && operationsCredentials.password);
}

export async function staffLogin(page: Page): Promise<void> {
  await gotoStaffPage(page, "/admin");
  if (!/\/login(?:\?|$)/.test(page.url())) {
    await assertAuthenticatedStaffSession(page);
    return;
  }
  await login(page, staffCredentials);
  await assertAuthenticatedStaffSession(page);
}

/** Re-authenticates when a long visual run loses cookies mid-suite. */
export async function ensureAuthenticatedStaffSession(page: Page): Promise<void> {
  const onLogin = /\/login(?:\?|$)/.test(page.url());
  const loginPassword = page.locator('input[name="password"]').first();
  if (!(onLogin || (await loginPassword.isVisible().catch(() => false)))) {
    await assertAuthenticatedStaffSession(page);
    return;
  }

  await staffLogin(page);
  await assertAuthenticatedStaffSession(page);
}

export async function catalogueManagerLogin(page: Page): Promise<void> {
  await login(page, catalogueCredentials);
  await page.goto("/admin/lots", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /^lots$/i }).first()).toBeVisible({
    timeout: 20_000,
  });
}

export async function financeLogin(page: Page): Promise<void> {
  await login(page, financeCredentials);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await assertAuthenticatedStaffSession(page);
}

export async function readonlyStaffLogin(page: Page): Promise<void> {
  await login(page, readonlyCredentials);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await assertAuthenticatedStaffSession(page);
}

export async function operationsLogin(page: Page): Promise<void> {
  await login(page, operationsCredentials);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await assertAuthenticatedStaffSession(page);
}

export async function buyerLogin(page: Page): Promise<void> {
  await login(page, buyerCredentials, { destination: /\/(admin|dashboard|onboarding)/ });
  const onAdminStaff = page.getByRole("navigation", { name: /staff dashboard/i });
  if (await onAdminStaff.isVisible().catch(() => false)) {
    throw new Error(
      "Buyer login landed on staff admin shell — check credentials and storage state.",
    );
  }
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

export async function expectNoSeriousAxeViolationsInDialog(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = result.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
  const details = formatAxeViolations(blocking);
  expect(blocking, blocking.length > 0 ? `Axe violations:\n${details}` : undefined).toHaveLength(0);
}

export async function stabilizeVisualPage(page: Page): Promise<void> {
  await dismissCookieConsentIfVisible(page);
  await dismissStaffPaletteIfOpen(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
}
