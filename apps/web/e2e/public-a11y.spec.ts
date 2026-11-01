import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import {
  type A11yBaseline,
  type FoundViolation,
  describeRatchet,
  evaluateRatchet,
} from "../src/test/a11y/axe-ratchet";
import { type PublicRoute, resolvePublicRoutes } from "./public-routes";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start the seeded stack.";
const BASELINE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "a11y-baseline.json");
const writeBaseline = process.env.A11Y_WRITE_BASELINE === "1";

/** WCAG 2.2 AA. Best-practice results are advisory and do not run here. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;

const found: FoundViolation[] = [];
const routesChecked = new Set<string>();

/** The not-found pages render outside the site shell today, so they have no shared main landmark. */
async function settle(page: Page, route: PublicRoute) {
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  if (route.name.includes("not-found")) await expect(page.locator("body")).toBeVisible();
  else await expect(page.locator("#main-content")).toBeVisible();
}

/** Whole page, so the header, family bar, footer and cookie banner are checked with the content. */
async function scan(page: Page, route: string, variant: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  for (const violation of results.violations) {
    found.push({ route, rule: violation.id, impact: violation.impact ?? null, variant });
  }
}

async function open(page: Page, route: PublicRoute) {
  const res = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  // Not-found routes answer 404 on purpose; every other route must load.
  if (!route.name.includes("not-found")) expect(res?.ok(), route.path).toBeTruthy();
  await settle(page, route);
}

test.describe("public site accessibility @a11y @public-a11y", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(600_000);

  let routes: PublicRoute[] = [];

  test.beforeAll(async ({ playwright }) => {
    if (!enabled) return;
    const request = await playwright.request.newContext();
    routes = await resolvePublicRoutes(request);
    await request.dispose();
  });

  for (const viewport of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      const variant = `${viewport.label} ${scheme}`;
      test(`routes at ${variant}`, async ({ browser, baseURL }) => {
        test.skip(!enabled, skipReason);
        const context = await browser.newContext({
          baseURL: baseURL ?? "http://localhost:3000",
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: scheme,
          // Scroll reveals fade from opacity 0; axe would sample mid-fade colours.
          reducedMotion: "reduce",
        });
        await context.addCookies([
          { name: "lax_theme", value: scheme, url: baseURL ?? "http://localhost:3000" },
        ]);
        const page = await context.newPage();
        for (const route of routes) {
          await open(page, route);
          routesChecked.add(route.name);
          await scan(page, route.name, variant);
        }
        await context.close();
      });
    }
  }

  test("interaction states", async ({ browser, baseURL }) => {
    test.skip(!enabled, skipReason);
    const origin = baseURL ?? "http://localhost:3000";
    const context = await browser.newContext({ baseURL: origin, reducedMotion: "reduce" });
    const page = await context.newPage();

    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, { name: "home", path: "/" });
    const customise = page.getByRole("button", { name: /customise|settings/i }).first();
    if (await customise.isVisible()) {
      await customise.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await scan(page, "cookie-settings", "1440 light");
      routesChecked.add("cookie-settings");
      await page.keyboard.press("Escape");
    }

    await open(page, { name: "home", path: "/" });
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    await scan(page, "home-keyboard-focus", "1440 light");
    routesChecked.add("home-keyboard-focus");

    await open(page, { name: "contact", path: "/contact" });
    await page.getByRole("button", { name: /send/i }).first().click();
    await scan(page, "contact-empty-submit", "1440 light");
    routesChecked.add("contact-empty-submit");

    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, { name: "home", path: "/" });
    const menu = page.getByRole("button", { name: /menu/i }).first();
    if (await menu.isVisible()) {
      await menu.click();
      await scan(page, "mobile-menu-open", "375 light");
      routesChecked.add("mobile-menu-open");
    }
    await context.close();
  });

  test("moderate violations only shrink, serious and critical never appear", () => {
    test.skip(!enabled, skipReason);
    if (writeBaseline) {
      const next: A11yBaseline = {};
      for (const v of found.filter((x) => x.impact === "moderate")) {
        const rules = next[v.route] ?? [];
        if (!rules.includes(v.rule)) rules.push(v.rule);
        next[v.route] = rules.sort();
      }
      const ordered = Object.fromEntries(
        Object.entries(next).sort(([a], [b]) => a.localeCompare(b)),
      );
      writeFileSync(BASELINE_PATH, `${JSON.stringify(ordered, null, 2)}\n`);
      return;
    }
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as A11yBaseline;
    const problems = describeRatchet(evaluateRatchet(found, baseline, [...routesChecked]));
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
