import AxeBuilder from "@axe-core/playwright";
import { type Browser, type Page, expect, test } from "@playwright/test";
import { formatAxeViolations } from "./auth";
import { type OrganisationSession, openAs, openPersonal } from "./organisation-journeys";

/**
 * Accessibility baselines for the client workspace: every page a member can reach from the
 * sidebar (or, on the public site, the "Your account" row), for each role, in light and dark at
 * 1440 and 375. A page the role may not open shows the access page, which is checked the same
 * way, so a role's whole surface is covered without a list per role.
 */

/** The organisation workspace: the sidebar's pages, the inbox and the settings. */
export const WORKSPACE_PAGES = [
  "/home",
  "/bids",
  "/purchases",
  "/watching",
  "/selling/consignments",
  "/selling/payouts",
  "/collection",
  "/team",
  "/organisation",
  "/notifications",
  "/settings",
] as const;

/** A person's own pages on the public site, under "Your account". */
export const PERSONAL_PAGES = [
  "/bids",
  "/purchases",
  "/watching",
  "/selling/consignments",
  "/notifications",
  "/settings",
] as const;

const THEME_COOKIE = "lax_theme";

/** Each theme is a page load (the server renders it from the theme cookie). */
export const BASELINE_SCHEMES = ["light", "dark"] as const;

/** Each width is checked on the loaded page, by resizing it. */
export const BASELINE_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
] as const;

/** Opens `path` in `scheme`, settled: content loaded, no transitions left to paint. */
async function openSettled(
  { page, origin }: OrganisationSession,
  path: string,
  scheme: "light" | "dark",
): Promise<void> {
  await page.context().addCookies([{ name: THEME_COOKIE, value: scheme, url: origin }]);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  await page.goto(path);
  await expect(page.locator("#main-content")).toBeVisible();
  // Lists stream in behind a skeleton; check the page once it has its content.
  await expect(page.locator('output[aria-label^="Loading"], [aria-busy="true"]')).toHaveCount(0, {
    timeout: 20_000,
  });
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
}

async function blockingViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .include("#main-content")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  return result.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
}

/**
 * Opens each page in each theme and checks it at each width. Failures are soft, so one run lists
 * every page, theme and width that fails rather than stopping at the first.
 */
export async function expectPagesAccessible(
  session: OrganisationSession,
  paths: readonly string[],
): Promise<void> {
  const { page } = session;
  for (const path of paths) {
    await test.step(path, async () => {
      for (const scheme of BASELINE_SCHEMES) {
        await page.setViewportSize(BASELINE_VIEWPORTS[0]);
        await openSettled(session, path, scheme);
        for (const viewport of BASELINE_VIEWPORTS) {
          await page.setViewportSize(viewport);
          const blocking = await blockingViolations(page);
          expect
            .soft(
              blocking,
              blocking.length > 0
                ? `${path} at ${viewport.width} ${scheme}:\n${formatAxeViolations(blocking)}`
                : undefined,
            )
            .toHaveLength(0);
        }
      }
    });
  }
}

/** A member acting for an organisation, checked on every workspace page. */
export async function expectWorkspaceBaselines(
  browser: Browser,
  storageState: string,
  organisationName: string,
  baseURL: string | undefined,
): Promise<void> {
  const session = await openAs(browser, storageState, organisationName, baseURL);
  await runBaselines(session, WORKSPACE_PAGES);
}

/** A person on their own account, checked on every page under "Your account". */
export async function expectPersonalBaselines(
  browser: Browser,
  storageState: string,
  baseURL: string | undefined,
): Promise<void> {
  const session = await openPersonal(browser, storageState, baseURL);
  await runBaselines(session, PERSONAL_PAGES);
}

async function runBaselines(session: OrganisationSession, paths: readonly string[]): Promise<void> {
  try {
    await expectPagesAccessible(session, paths);
  } finally {
    await session.close();
  }
}
