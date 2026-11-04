import { type Browser, type BrowserContext, type Page, expect } from "@playwright/test";
import { ARTWORK_EDITOR_PATH } from "./lax-admin-pages.js";
import { signInStaffThroughIdentity } from "./staff-sign-in.js";

export type StaffTheme = "light" | "dark";

export type StaffAccount = { email: string; password: string; totpSecret?: string };

export const e2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
export const authBaseUrl = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(
  /\/+$/,
  "",
);

/**
 * The cookie the server reads the staff theme from (STAFF_THEME_COOKIE in @auction/staff-ui).
 * Kept as a literal here so the specs do not load the component kit.
 */
const THEME_COOKIE = "lax_staff_theme";

/**
 * The administrator the pages are checked as. A deployed environment passes the acceptance
 * account; the CI stack passes the seeded administrator.
 */
export function administratorAccount(): StaffAccount | null {
  const email = process.env.SHOP_ADMIN_ACCEPTANCE_EMAIL ?? process.env.PLAYWRIGHT_STAFF_EMAIL;
  const password =
    process.env.SHOP_ADMIN_ACCEPTANCE_PASSWORD ?? process.env.PLAYWRIGHT_STAFF_PASSWORD;
  if (!email || !password) return null;
  const totpSecret = process.env.SHOP_ADMIN_ACCEPTANCE_TOTP_SECRET?.trim();
  return { email, password, ...(totpSecret ? { totpSecret } : {}) };
}

export type StaffSession = { context: BrowserContext; page: Page };

/** Signs `account` in, in a fresh browser context with the theme and window size chosen. */
export async function openStaffSession(input: {
  browser: Browser;
  baseURL: string;
  account: StaffAccount;
  theme: StaffTheme;
  viewport: { width: number; height: number };
}): Promise<StaffSession> {
  const context = await input.browser.newContext({
    baseURL: input.baseURL,
    colorScheme: input.theme,
    reducedMotion: "reduce",
    viewport: input.viewport,
  });
  // The theme is a cookie the server reads, so the first paint is already in the chosen scheme.
  await context.addCookies([{ name: THEME_COOKIE, value: input.theme, url: input.baseURL }]);
  const page = await context.newPage();
  await signInStaffThroughIdentity({
    page,
    authBaseUrl,
    email: input.account.email,
    password: input.account.password,
    ...(input.account.totpSecret ? { totpSecret: input.account.totpSecret } : {}),
    returnTo: "/overview",
  });
  return { context, page };
}

/** Opens a staff page and waits until it has rendered content rather than an error. */
export async function openStaffPage(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Could not load" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Access denied" })).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

/** The artwork editor's real path, or null when the environment has no artworks. */
export async function resolveStaffPath(page: Page, path: string): Promise<string | null> {
  if (path !== ARTWORK_EDITOR_PATH) return path;
  const response = await page.request.get("/api/admin/artworks");
  if (!response.ok()) return null;
  const body = (await response.json()) as { items?: Array<{ artworkId?: string }> };
  const artworkId = body.items?.[0]?.artworkId;
  return artworkId ? `/artworks/${artworkId}` : null;
}
