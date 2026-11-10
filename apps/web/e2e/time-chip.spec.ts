import { describeMoment } from "@auction/datetime";
import { lotPath, salePath } from "@auction/types";
import AxeBuilder from "@axe-core/playwright";
import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type PlaywrightWorkerArgs,
  expect,
  test,
} from "@playwright/test";
import { resolveLotRoutes, resolveSaleRoutes } from "./public-routes";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start the seeded stack.";
const API =
  process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;

/** `viewer` is what the device reports; UTC is what privacy modes send, so it counts as unknown. */
const DEVICES = [
  { name: "Cairo", id: "Africa/Cairo" },
  { name: "Sydney", id: "Australia/Sydney" },
  { name: "London", id: "Europe/London" },
  { name: "UTC", id: "UTC" },
] as const;

type Subject = {
  name: "lot page" | "sale hero";
  path: string;
  /** The moment the chip converts, and the zone the sale quotes it in. */
  instant: string;
  officialZone: string;
};

type Json = { data?: Record<string, unknown> };

async function getJson(request: APIRequestContext, path: string) {
  const res = await request.get(`${API}${path}`);
  return ((await res.json()) as Json).data ?? {};
}

async function resolveSubjects(request: APIRequestContext): Promise<Subject[]> {
  const subjects: Subject[] = [];
  const lot = (await resolveLotRoutes(request)).find((route) => route.name === "lot-live");
  if (lot) {
    const id = lot.path.split("/").pop() ?? "";
    const row = await getJson(request, `/lots/${id}`);
    if (typeof row.endTime === "string") {
      subjects.push({
        name: "lot page",
        // The canonical address, so the page is not replaced by a redirect while it is read.
        path: lotPath({ id, title: String(row.title ?? "") }),
        instant: new Date(row.endTime).toISOString(),
        officialZone: typeof row.timeZone === "string" ? row.timeZone : "Europe/London",
      });
    }
  }
  const sale = (await resolveSaleRoutes(request)).find((route) => route.name === "sale-timed");
  if (sale) {
    const id = sale.path.split("/").pop() ?? "";
    const row = ((await getJson(request, `/sales/${id}`)).sale ?? {}) as Record<string, unknown>;
    if (typeof row.startTime === "string") {
      subjects.push({
        name: "sale hero",
        path: salePath({ id, title: String(row.title ?? "") }),
        instant: new Date(row.startTime).toISOString(),
        officialZone: typeof row.timeZone === "string" ? row.timeZone : "Europe/London",
      });
    }
  }
  return subjects;
}

/**
 * Records, from the first frame, the chip row's height and any layout shift around it. The
 * layout-shift entries count only when one of their sources sits inside the row's own block,
 * so the page's fixed bars and fonts, which this change does not touch, never decide the result.
 */
const SHIFT_PROBE = `(() => {
  const state = { cls: 0, heights: [] };
  window.__chipProbe = state;
  const block = () => document.querySelector(".tz-chip-slot")?.closest("dl, p, section") ?? null;
  new PerformanceObserver((list) => {
    const root = block()?.parentElement ?? null;
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      if (root && entry.sources?.some((s) => s.node && root.contains(s.node))) state.cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
  const sample = () => {
    const slot = document.querySelector(".tz-chip-slot");
    if (slot) state.heights.push(Math.round(slot.getBoundingClientRect().height));
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
})();`;

type Visit = { page: Page; context: BrowserContext; problems: string[] };

async function visit(
  browser: Browser,
  baseURL: string,
  opts: {
    zone: string;
    cookie: boolean;
    viewport: (typeof VIEWPORTS)[number];
    scheme: (typeof SCHEMES)[number];
    path: string;
  },
): Promise<Visit> {
  const context = await browser.newContext({
    baseURL,
    timezoneId: opts.zone,
    viewport: { width: opts.viewport.width, height: opts.viewport.height },
    colorScheme: opts.scheme,
    // Scroll reveals fade from opacity 0; axe would sample mid-fade colours.
    reducedMotion: "reduce",
  });
  const consent = {
    v: 1,
    ts: "2026-11-01T00:00:00.000Z",
    necessary: true,
    analytics: false,
    marketing: false,
  };
  await context.addCookies([
    { name: "lax_theme", value: opts.scheme, url: baseURL },
    { name: "lax_consent", value: encodeURIComponent(JSON.stringify(consent)), url: baseURL },
    ...(opts.cookie
      ? [{ name: "lax_tz", value: encodeURIComponent(opts.zone), url: baseURL }]
      : []),
  ]);
  await context.addInitScript(SHIFT_PROBE);
  const page = await context.newPage();
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/hydrat|did not match|#418|#423|#425/i.test(text)) problems.push(text);
  });
  await page.goto(opts.path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content")).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  return { page, context, problems };
}

const chipOf = (page: Page) => page.getByRole("button", { name: /^Your time:/ });

async function expectChipState(page: Page, subject: Subject, zone: string) {
  const viewerZone = zone === "UTC" ? "UTC" : zone;
  const moment = describeMoment(new Date(subject.instant), {
    officialZone: subject.officialZone,
    viewerZone,
    now: new Date(),
  });
  if (!moment.local) {
    await expect(chipOf(page)).toHaveCount(0);
    // No chip and no gap: the empty row takes no room.
    await expect(page.locator(".tz-chip-slot").first()).toBeHidden();
    await expect(page.locator("html")).not.toHaveClass(/tz-away/);
    return;
  }
  const chip = chipOf(page);
  await expect(chip).toBeVisible();
  await expect(chip).toContainText(moment.local.text);
  await expect(chip).toHaveAccessibleName(`${moment.spoken} Show details.`);
  await expect(chip).toHaveAttribute("aria-expanded", "false");
  const box = await chip.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(26);
  await expect(page.locator("html")).toHaveClass(/tz-away/);
}

async function expectStable(page: Page) {
  await page.waitForLoadState("load");
  // Let the late fill (hydration, fonts) finish before reading the probe.
  await page.waitForFunction(() => document.readyState === "complete");
  const probe = await page.evaluate(
    () => (window as unknown as { __chipProbe: { cls: number; heights: number[] } }).__chipProbe,
  );
  expect(probe.cls, "layout shift inside the time block").toBe(0);
  // The row holds its height from the first frame that has one, so nothing under it can move
  // when the chip arrives.
  const first = probe.heights.findIndex((h) => h > 0);
  if (first >= 0) {
    expect(new Set(probe.heights.slice(first)).size, "the chip row changed height").toBe(1);
  }
}

type Combo = { viewport: (typeof VIEWPORTS)[number]; scheme: (typeof SCHEMES)[number] };

const ALL_COMBOS: Combo[] = VIEWPORTS.flatMap((viewport) =>
  SCHEMES.map((scheme) => ({ viewport, scheme })),
);

/** One light desktop and one dark phone: enough to catch a broken page on every pull request. */
const SMOKE_COMBOS: Combo[] = [
  { viewport: VIEWPORTS[0], scheme: "light" },
  { viewport: VIEWPORTS[1], scheme: "dark" },
];

async function checkDevice(
  browser: Browser,
  origin: string,
  subjects: Subject[],
  device: (typeof DEVICES)[number],
  withCookie: boolean,
  combos: Combo[],
) {
  expect(subjects.length, "seeded lot and sale").toBeGreaterThan(0);
  for (const subject of subjects) {
    for (const { viewport, scheme } of combos) {
      const where = `${subject.name} ${viewport.label} ${scheme}`;
      const { page, context, problems } = await visit(browser, origin, {
        zone: device.id,
        cookie: withCookie,
        viewport,
        scheme,
        path: subject.path,
      });
      await expectChipState(page, subject, device.id);
      await expectStable(page);
      expect(problems, `hydration warnings, ${where}`).toEqual([]);
      if (device.name === "Cairo" || device.name === "Sydney") {
        const results = await new AxeBuilder({ page })
          .include(".tz-chip-slot")
          .withTags(WCAG_TAGS)
          .analyze();
        expect(results.violations, `axe, ${where}`).toEqual([]);
      }
      await context.close();
    }
  }
}

async function resolveOnce(playwright: PlaywrightWorkerArgs["playwright"]): Promise<Subject[]> {
  const request = await playwright.request.newContext();
  const subjects = await resolveSubjects(request);
  await request.dispose();
  return subjects;
}

test.describe("time chip on a visitor's first visit @smoke @time-zone", () => {
  test.setTimeout(180_000);
  let subjects: Subject[] = [];

  test.beforeAll(async ({ playwright }) => {
    if (enabled) subjects = await resolveOnce(playwright);
  });

  for (const device of DEVICES) {
    test(`${device.name}`, async ({ browser, baseURL }) => {
      test.skip(!enabled, skipReason);
      await checkDevice(
        browser,
        baseURL ?? "http://localhost:3000",
        subjects,
        device,
        false,
        SMOKE_COMBOS,
      );
    });
  }
});

test.describe("time chip in every zone, viewport and theme @journey @time-zone", () => {
  test.setTimeout(300_000);
  let subjects: Subject[] = [];

  test.beforeAll(async ({ playwright }) => {
    if (enabled) subjects = await resolveOnce(playwright);
  });

  for (const device of DEVICES) {
    for (const withCookie of [true, false]) {
      test(`${device.name}, ${withCookie ? "cookie present" : "first visit"}`, async ({
        browser,
        baseURL,
      }) => {
        test.skip(!enabled, skipReason);
        await checkDevice(
          browser,
          baseURL ?? "http://localhost:3000",
          subjects,
          device,
          withCookie,
          ALL_COMBOS,
        );
      });
    }
  }

  test("the panel and the zone dialog work from the keyboard and save to this device", async ({
    browser,
    baseURL,
  }) => {
    test.skip(!enabled, skipReason);
    const origin = baseURL ?? "http://localhost:3000";
    const subject = subjects.find((s) => s.name === "lot page");
    expect(subject, "seeded lot").toBeTruthy();
    for (const viewport of VIEWPORTS) {
      for (const scheme of SCHEMES) {
        const { page, context } = await visit(browser, origin, {
          zone: "Australia/Sydney",
          cookie: true,
          viewport,
          scheme,
          path: subject?.path ?? "/",
        });
        const chip = chipOf(page);
        await chip.focus();
        await page.keyboard.press("Enter");
        const panel = page.getByRole("dialog", { name: "Your time" });
        await expect(panel).toBeVisible();
        await expect(chip).toHaveAttribute("aria-expanded", "true");
        expect(
          (
            await new AxeBuilder({ page })
              .include('[aria-label="Your time"]')
              .withTags(WCAG_TAGS)
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(panel).toBeHidden();
        await expect(chip).toBeFocused();

        await chip.click();
        await page.getByRole("button", { name: "Change time zone" }).click();
        const dialog = page.getByRole("dialog", { name: "Time zone" });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(
          "Saved on this device. Sign in to use it in your emails too.",
        );
        expect(
          (await new AxeBuilder({ page }).include('[role="dialog"]').withTags(WCAG_TAGS).analyze())
            .violations,
        ).toEqual([]);
        await dialog.getByRole("searchbox", { name: "Search cities" }).fill("Dubai");
        await dialog.getByRole("radio", { name: /Dubai/ }).check();
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(dialog).toBeHidden();
        await expect(chipOf(page)).toContainText("in Dubai");
        await expect(chipOf(page)).toBeFocused();
        const cookies = await context.cookies();
        expect(decodeURIComponent(cookies.find((c) => c.name === "lax_tz")?.value ?? "")).toBe(
          "fixed:Asia/Dubai",
        );
        // The choice is kept: the server draws it on the next request.
        await page.reload();
        await expect(chipOf(page)).toContainText("in Dubai");
        await context.close();
      }
    }
  });
});
