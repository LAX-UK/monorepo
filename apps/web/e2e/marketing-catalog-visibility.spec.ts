import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

const draftLotPath =
  process.env.PLAYWRIGHT_DRAFT_LOT_PATH ??
  (process.env.PLAYWRIGHT_DRAFT_LOT_ID
    ? `/lot/draft-lot/${process.env.PLAYWRIGHT_DRAFT_LOT_ID}`
    : "");

test.describe("marketing catalog visibility @smoke", () => {
  test("home loads without per-sale detail fetches for catalog strips", async ({ page }) => {
    test.skip(!enabled, skipReason);

    const saleDetailRequests: string[] = [];
    await page.route("**/sales/*", (route) => {
      const url = route.request().url();
      if (/\/sales\/[0-9a-f-]{36}$/i.test(url)) {
        saleDetailRequests.push(url);
      }
      return route.continue();
    });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("#main-content")).toBeVisible();

    expect(saleDetailRequests.length).toBe(0);
  });

  test("home editor's picks lot links resolve for anonymous visitors", async ({
    page,
    request,
  }) => {
    test.skip(!enabled, skipReason);

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const lotLinks = page.locator('#main-content a[href*="/lot/"]');
    const count = await lotLinks.count();
    test.skip(count === 0, "No lot links on home; seed public lots for this check");

    const href = await lotLinks.first().getAttribute("href");
    expect(href).toBeTruthy();
    if (!href) return;
    const res = await request.get(href);
    expect(res.status()).not.toBe(404);
  });

  test("search default page loads main content", async ({ page }) => {
    test.skip(!enabled, skipReason);
    const res = await page.goto("/search");
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("search default lot payloads exclude draft status", async ({ page }) => {
    test.skip(!enabled, skipReason);

    const draftPayloads: unknown[] = [];
    await page.route("**/lots?**", async (route) => {
      const response = await route.fetch();
      const json = (await response.json()) as { data?: { status?: string }[] };
      for (const row of json.data ?? []) {
        if (row.status === "draft") draftPayloads.push(row);
      }
      await route.fulfill({ response });
    });

    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    expect(draftPayloads).toHaveLength(0);
  });

  test("anonymous draft lot URL returns not found when PLAYWRIGHT_DRAFT_LOT_PATH is set", async ({
    page,
  }) => {
    test.skip(!enabled, skipReason);
    test.skip(!draftLotPath, "Set PLAYWRIGHT_DRAFT_LOT_PATH or PLAYWRIGHT_DRAFT_LOT_ID");

    const res = await page.goto(draftLotPath);
    expect(res?.status()).toBe(404);
  });
});
