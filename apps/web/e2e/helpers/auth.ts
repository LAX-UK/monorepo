import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, type Page, type Response, expect } from "@playwright/test";

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

const clientCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "user1@lax.bid",
  password: process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "Password123!",
};

const unapprovedCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_UNAPPROVED_EMAIL ?? "gallery-finance@lax.bid",
  password: process.env.PLAYWRIGHT_UNAPPROVED_PASSWORD ?? "Password123!",
};

const incompleteCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_INCOMPLETE_EMAIL ?? "viewer@lax.bid",
  password: process.env.PLAYWRIGHT_INCOMPLETE_PASSWORD ?? "Password123!",
};

const zeroLotCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_ZERO_LOT_EMAIL ?? "apple-test@lax.bid",
  password: process.env.PLAYWRIGHT_ZERO_LOT_PASSWORD ?? "Password123!",
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
  if (page.isClosed()) return;
  // Title is sr-only, so heading.isVisible() stays false while the dialog is open.
  const palette = page.getByRole("dialog", { name: /quick go/i });
  try {
    if ((await palette.count()) === 0) return;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (page.isClosed() || (await palette.count()) === 0) return;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/execution context was destroyed|target closed/i.test(message)) return;
    throw error;
  }
}

async function dismissCookieConsentIfVisible(page: Page): Promise<void> {
  const acceptCookies = page.getByRole("button", { name: /accept all/i });
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click();
    await acceptCookies.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
}

export type SessionProbe = {
  authenticated: boolean;
  sessionAlive: boolean;
  authStatus: number;
  meStatus: number;
  email: string | null;
  cookieNames: string[];
};

function trimUrl(value: string | undefined, fallback: string): string {
  return (value ?? fallback).replace(/\/+$/, "");
}

/** Probes Better Auth and the Bid BFF session bridge on the web app. */
export async function probePageSession(page: Page): Promise<SessionProbe> {
  const authUrl = trimUrl(
    process.env.OIDC_ISSUER_URL ?? process.env.NEXT_PUBLIC_AUTH_URL,
    "http://localhost:3003",
  );
  const webOrigin = trimUrl(
    process.env.WEB_ORIGIN ?? process.env.PLAYWRIGHT_BASE_URL,
    "http://localhost:3000",
  );
  const stored = await page.context().storageState();
  const [authRes, meRes] = await Promise.all([
    page.request.get(`${authUrl}/api/auth/get-session`),
    page.request.get(`${webOrigin}/api/auth/me`),
  ]);
  const authBody = (await authRes.json().catch(() => null)) as {
    user?: { id?: string; email?: string };
  } | null;
  const meBody = (await meRes.json().catch(() => null)) as {
    data?: { email?: string };
    email?: string;
    authenticated?: boolean;
  } | null;
  const sessionAlive = Boolean(authBody?.user?.id) && authRes.ok();
  return {
    sessionAlive,
    authenticated: meRes.ok() && meBody?.authenticated === true,
    authStatus: authRes.status(),
    meStatus: meRes.status(),
    email: authBody?.user?.email ?? meBody?.data?.email ?? meBody?.email ?? null,
    cookieNames: stored.cookies.map((cookie) => cookie.name),
  };
}

/** Writes the live cookie jar back only when a session token is still present. */
export async function persistContextAuthState(
  context: BrowserContext,
  storageState: unknown,
): Promise<void> {
  if (typeof storageState !== "string") return;
  const state = await context.storageState();
  if (!state.cookies.some((cookie) => /(?:__Host-)?lax-bid-session/.test(cookie.name))) return;
  await context.storageState({ path: storageState });
}

function formatPageSessionFailure(path: string, probe: SessionProbe, url: string): string {
  return [
    `Expected authenticated staff session for ${path} but landed on ${url}.`,
    `get-session=${probe.authStatus}`,
    `/api/auth/me=${probe.meStatus}`,
    `cookies=${probe.cookieNames.join(",") || "(none)"}`,
  ].join(" ");
}

function hasBidSessionCookie(probe: SessionProbe): boolean {
  return probe.cookieNames.some((name) => /(?:__Host-)?lax-bid-session/.test(name));
}

/** Re-establishes the Bid BFF cookie when Identity cookies exist but `/api/auth/me` is 401. */
async function recoverBidBffSession(page: Page, returnPath: string): Promise<boolean> {
  const probe = await probePageSession(page);
  if (probe.authenticated) return true;
  if (!probe.sessionAlive || hasBidSessionCookie(probe)) return false;

  const destination = new RegExp(
    `${returnPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|/admin(?:/|$|\\?)|/dashboard(?:/|$|\\?)`,
  );
  await page.goto(`/api/auth/login?next=${encodeURIComponent(returnPath)}`, {
    waitUntil: "domcontentloaded",
  });
  try {
    await page.waitForURL(
      (url) => destination.test(url.toString()) || isOidcConsentUrl(url.toString()),
      { timeout: 60_000, waitUntil: "domcontentloaded" },
    );
  } catch {
    return (await probePageSession(page)).authenticated;
  }

  if (isOidcConsentUrl(page.url())) {
    await submitOidcConsent(page, destination);
  }

  return (await probePageSession(page)).authenticated;
}

function isLoginUrl(url: string): boolean {
  return /\/login(?:\?|$)/.test(url);
}

/**
 * Navigate to a staff path. One reload is allowed when the cookie is still
 * valid and SSR `/users/me` missed. Tests never password-login or click Continue.
 */
export async function gotoAdminPath(page: Page, path: string): Promise<Response | null> {
  let response = await page.goto(path, { waitUntil: "domcontentloaded" });
  if (!isLoginUrl(page.url())) return response;

  let probe = await probePageSession(page);
  if (probe.sessionAlive) {
    response = await page.goto(path, { waitUntil: "domcontentloaded" });
    if (!isLoginUrl(page.url())) return response;
  }

  if (!probe.authenticated && probe.sessionAlive) {
    const recovered = await recoverBidBffSession(page, path);
    if (recovered) {
      response = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (!isLoginUrl(page.url())) return response;
    }
  }

  probe = await probePageSession(page);
  throw new Error(formatPageSessionFailure(path, probe, page.url()));
}

/** Dev servers often never reach `load`; prefer domcontentloaded for staff navigation. */
export async function gotoStaffPage(
  page: Page,
  path: string,
  options?: { waitUntil?: "domcontentloaded" | "load" },
): Promise<Response | null> {
  return page.goto(path, { waitUntil: options?.waitUntil ?? "domcontentloaded" });
}

function isOidcConsentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/api/auth/oauth2/authorize";
  } catch {
    return /\/api\/auth\/oauth2\/authorize(?:\?|$)/.test(url);
  }
}

async function submitOidcConsent(page: Page, destination: RegExp): Promise<void> {
  const allow = page.getByRole("button", { name: /^allow$/i });
  await allow.waitFor({ state: "visible", timeout: 30_000 });
  await Promise.all([
    page.waitForURL(destination, { timeout: 60_000, waitUntil: "domcontentloaded" }),
    allow.click(),
  ]).catch(async (error) => {
    const visibleError = page.locator('#error[role="alert"]:not([hidden])');
    if (await visibleError.isVisible().catch(() => false)) {
      const text = (await visibleError.textContent())?.trim();
      throw new Error(`OIDC consent failed (${page.url()}). ${text ?? "unknown error"}`);
    }
    throw error;
  });
}

async function waitForLoginDestination(page: Page, destination: RegExp): Promise<void> {
  try {
    await page.waitForURL(
      (url) => destination.test(url.toString()) || isOidcConsentUrl(url.toString()),
      { timeout: 60_000, waitUntil: "domcontentloaded" },
    );
  } catch (error) {
    if (await resumeIfAlreadySignedIn(page, destination)) return;
    throw error;
  }

  if (
    isOidcConsentUrl(page.url()) ||
    (await page
      .locator("#oidc-consent")
      .isVisible()
      .catch(() => false))
  ) {
    await submitOidcConsent(page, destination);
    return;
  }

  if (!destination.test(page.url())) {
    throw new Error(`Sign-in did not redirect (${page.url()}). Expected ${destination}.`);
  }
}

async function readLoginBannerErrors(page: Page): Promise<string> {
  if (page.isClosed()) return "";
  const bannerError = await page
    .locator('[role="alert"]:visible, output[aria-live="polite"]:visible')
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
  await waitForLoginDestination(page, destination);
  return true;
}

function preservedNextFromUrl(url: string): string | null {
  try {
    const next = new URL(url).searchParams.get("next");
    return next && isSafeNextPath(next) ? next : null;
  } catch {
    return null;
  }
}

async function login(
  page: Page,
  credentials: Credentials,
  options: LoginOptions = {},
): Promise<void> {
  const destination = options.destination ?? /\/(admin|dashboard)/;
  const preservedNext = preservedNextFromUrl(page.url());
  const loginUrl = preservedNext
    ? `/login?email=${encodeURIComponent(credentials.email)}&next=${encodeURIComponent(preservedNext)}`
    : `/login?email=${encodeURIComponent(credentials.email)}`;
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
    await waitForLoginDestination(page, destination);
    return;
  }

  if (await continueToCredentials.isVisible().catch(() => false)) {
    await continueToCredentials.click();
  }

  await password.waitFor({ state: "visible", timeout: 20_000 });
  await password.click();
  await password.fill(credentials.password);
  const submit = page.getByRole("button", { name: /^sign in$/i });
  try {
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    } else {
      await page
        .locator("form")
        .first()
        .evaluate((form) => (form as HTMLFormElement).requestSubmit());
    }
    await waitForLoginDestination(page, destination);
  } catch (error) {
    if (await resumeIfAlreadySignedIn(page, destination)) return;
    const detail = await readLoginBannerErrors(page);
    throw new Error(
      detail
        ? `Sign-in did not redirect (${page.url()}). ${detail}`
        : `Sign-in did not redirect (${page.url()}). ${String(error)}`,
    );
  }
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

export function hasClientCredentials(): boolean {
  return Boolean(clientCredentials.email && clientCredentials.password);
}

export function hasUnapprovedCredentials(): boolean {
  return Boolean(unapprovedCredentials.email && unapprovedCredentials.password);
}

export function hasIncompleteCredentials(): boolean {
  return Boolean(incompleteCredentials.email && incompleteCredentials.password);
}

export function hasZeroLotCredentials(): boolean {
  return Boolean(zeroLotCredentials.email && zeroLotCredentials.password);
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
  await login(page, staffCredentials, { destination: /\/admin(?:\/|$|\?)/ });
  await assertAuthenticatedStaffSession(page);
}

/** Fails with session-endpoint evidence instead of password-login recovery. */
export async function ensureAuthenticatedStaffSession(page: Page): Promise<void> {
  if (!isLoginUrl(page.url())) {
    await assertAuthenticatedStaffSession(page);
    return;
  }
  const probe = await probePageSession(page);
  throw new Error(formatPageSessionFailure(page.url(), probe, page.url()));
}

export async function catalogueManagerLogin(page: Page): Promise<void> {
  await login(page, catalogueCredentials);
  await gotoAdminPath(page, "/admin/lots");
  const probe = await probePageSession(page);
  if (!probe.authenticated) {
    throw new Error(
      `Catalogue manager login did not establish a Bid BFF session (get-session=${probe.authStatus}, /api/auth/me=${probe.meStatus}).`,
    );
  }
  await expect(page.getByRole("heading", { name: /^lots$/i }).first()).toBeVisible({
    timeout: 20_000,
  });
}

export async function financeLogin(page: Page): Promise<void> {
  await login(page, financeCredentials);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/admin(?:\/finance)?(?:\?|$)/);
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
  await assertNotStaffShell(page, "Buyer");
}

export async function clientLogin(page: Page): Promise<void> {
  await login(page, clientCredentials, { destination: /\/(admin|dashboard|onboarding)/ });
  await assertNotStaffShell(page, "Client");
}

export async function unapprovedLogin(page: Page): Promise<void> {
  await login(page, unapprovedCredentials, { destination: /\/(admin|dashboard|onboarding)/ });
  await assertNotStaffShell(page, "Unapproved buyer");
}

export async function incompleteLogin(page: Page): Promise<void> {
  await login(page, incompleteCredentials, { destination: /\/(admin|dashboard|onboarding)/ });
  await assertNotStaffShell(page, "Incomplete buyer");
}

export async function zeroLotLogin(page: Page): Promise<void> {
  await login(page, zeroLotCredentials, { destination: /\/(admin|dashboard|onboarding)/ });
  await assertNotStaffShell(page, "Zero-lot buyer");
}

async function assertNotStaffShell(page: Page, label: string): Promise<void> {
  const onAdminStaff = page.getByRole("navigation", { name: /staff dashboard/i });
  if (await onAdminStaff.isVisible().catch(() => false)) {
    throw new Error(
      `${label} login landed on staff admin shell — check credentials and storage state.`,
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
