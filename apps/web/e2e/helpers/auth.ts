import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

export const e2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
export const e2eSkipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web with seeded credentials.";

type Credentials = {
  email: string;
  password: string;
};

const staffCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_STAFF_EMAIL ?? "",
  password: process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "",
};

const catalogueCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL ?? "",
  password: process.env.PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD ?? "",
};

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
  if (await continueAuthed.isVisible().catch(() => false)) {
    await continueAuthed.click();
    await page.waitForURL(/\/(admin|dashboard)/, { timeout: 20_000 });
    return;
  }

  const password = page.locator('input[name="password"]');
  await password.waitFor({ state: "visible", timeout: 20_000 });
  await password.click();
  await password.fill(credentials.password);
  await page
    .locator("form")
    .first()
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 20_000 });
}

export function hasStaffCredentials(): boolean {
  return Boolean(staffCredentials.email && staffCredentials.password);
}

export function hasCatalogueManagerCredentials(): boolean {
  return Boolean(catalogueCredentials.email && catalogueCredentials.password);
}

export async function staffLogin(page: Page): Promise<void> {
  await login(page, staffCredentials);
}

export async function catalogueManagerLogin(page: Page): Promise<void> {
  await login(page, catalogueCredentials);
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
