import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials, seededStaffRoutes } from "./helpers/auth";
import { staffViewportDetailRoutes, staffViewportListRoutes } from "./helpers/staff-routes";

const VIEWPORTS = [
  { width: 390, height: 844, label: "mobile" },
  { width: 1023, height: 900, label: "constrained-desktop" },
  { width: 1440, height: 1000, label: "desktop" },
] as const;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth <= doc.clientWidth + 1;
  });
  expect(overflow).toBe(true);
}

test.describe("admin viewport audit @a11y", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);

  for (const viewport of VIEWPORTS) {
    test(`${viewport.label} — no horizontal overflow on staff list routes`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const path of staffViewportListRoutes) {
        const response = await page.goto(path);
        expect(response?.ok()).toBeTruthy();
        await page.locator("#main-content").waitFor({ state: "visible" });
        await assertNoHorizontalOverflow(page);
      }
    });

    test(`${viewport.label} — no horizontal overflow on staff detail routes`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const path of staffViewportDetailRoutes) {
        const response = await page.goto(path);
        expect(response?.ok()).toBeTruthy();
        await page.locator("#main-content").waitFor({ state: "visible" });
        await assertNoHorizontalOverflow(page);
      }
    });
  }

  test("mobile preview drawers do not overflow horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/admin/clients?client=${seededStaffRoutes.clientDetail}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto(`/admin/legal-entities?entity=${seededStaffRoutes.legalEntityDrawer}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("mobile filters sheet on lots list does not overflow horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/lots");
    await page.getByRole("button", { name: /^filters$/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
