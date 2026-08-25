import { type Page, expect, test } from "@playwright/test";
import {
  e2eEnabled,
  e2eSkipReason,
  expectNoSeriousAxeViolationsInDialog,
  expectNoSeriousAxeViolationsInMain,
  hasStaffCredentials,
  seededStaffRoutes,
} from "./helpers/auth";
import { staffCatalogListRoutes } from "./helpers/staff-routes";

const mobileViewport = { width: 375, height: 812 } as const;

async function assertMainContentA11y(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator("#main-content")).toBeVisible();
  await expectNoSeriousAxeViolationsInMain(page);
}

test.describe("admin a11y smoke @a11y", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);

  test("admin home has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin");
  });

  test("staff list has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/staff");
  });

  test("submissions list at mobile has no serious axe violations in main", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await assertMainContentA11y(page, "/admin/submissions");
  });

  test("condition reports list at mobile has no serious axe violations in main", async ({
    page,
  }) => {
    await page.setViewportSize(mobileViewport);
    await assertMainContentA11y(page, "/admin/condition-reports");
  });

  test("payment disputes list has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/disputes");
  });

  test("payments list has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/payments");
  });

  test("payouts list at mobile has no serious axe violations in main", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await assertMainContentA11y(page, "/admin/payouts");
  });

  test("AML compliance queue has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/compliance/aml");
  });

  test("source of funds compliance queue at mobile has no serious axe violations in main", async ({
    page,
  }) => {
    await page.setViewportSize(mobileViewport);
    await assertMainContentA11y(page, "/admin/compliance/source-of-funds");
  });

  test("source of funds case page main content is reachable from queue", async ({ page }) => {
    await page.goto("/admin/compliance/source-of-funds");
    await expect(page.locator("#main-content")).toBeVisible();

    const reviewLink = page.getByRole("link", { name: /^review$/i }).first();
    if ((await reviewLink.count()) === 0) {
      test.skip(true, "No pending Source of Funds cases in this environment");
    }

    await reviewLink.click();
    await expect(page).toHaveURL(/\/admin\/compliance\/source-of-funds\/[^/]+$/);
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("source of funds evidence reviewer confirms before discarding unsaved review", async ({
    page,
  }) => {
    await page.goto("/admin/compliance/source-of-funds");

    const reviewLink = page.getByRole("link", { name: /^review$/i }).first();
    if ((await reviewLink.count()) === 0) {
      test.skip(true, "No pending Source of Funds cases in this environment");
    }

    await reviewLink.click();
    await expect(page.getByRole("heading", { name: /evidence review/i })).toBeVisible();

    const docButtons = page
      .locator("section")
      .filter({ hasText: /evidence review/i })
      .getByRole("button");
    if ((await docButtons.count()) < 2) {
      test.skip(true, "Case needs at least two submitted documents to test dirty-state guard");
    }

    const firstDoc = docButtons.nth(0);
    const secondDoc = docButtons.nth(1);
    await firstDoc.click();

    const checklist = page.getByText("Verification checklist");
    if ((await checklist.count()) === 0) {
      test.skip(true, "Case is read-only or not pending — cannot edit review checklist");
    }

    const checkbox = page.getByRole("checkbox").first();
    const wasChecked = await checkbox.isChecked();
    await checkbox.click();

    let dialogSeen = false;
    page.once("dialog", async (dialog) => {
      dialogSeen = true;
      expect(dialog.message()).toMatch(/discard unsaved review changes/i);
      await dialog.dismiss();
    });

    await secondDoc.click();
    expect(dialogSeen).toBe(true);
    await expect(checkbox).toBeChecked({ checked: !wasChecked });
  });

  test("onboarding issues page has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/onboarding-issues");
  });

  test("invitations page has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/invitations");
  });

  test("lot fulfilment list at mobile has no serious axe violations in main", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await assertMainContentA11y(page, "/admin/lot-fulfilment");
  });

  test("finance hub has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/finance");
  });

  test("saleroom hub has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/saleroom");
  });

  test("manual review queue has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/payments?manualReview=1");
  });

  test("clients list has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/clients");
  });

  test("legal entities browse has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/legal-entities");
  });

  for (const route of staffCatalogListRoutes) {
    test(`${route.path} catalog browse has no serious axe violations in main`, async ({ page }) => {
      await assertMainContentA11y(page, route.path);
    });
  }

  test("event RSVPs hub has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/event-rsvps");
  });

  test("xero integration page has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/integrations/xero");
  });

  test("payout settlement page has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/payouts/settlement");
  });

  test("lots attention lens has no serious axe violations in main", async ({ page }) => {
    await assertMainContentA11y(page, "/admin/lots?lens=attention");
  });

  test("new lot wizard at mobile has no serious axe violations in main", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await assertMainContentA11y(page, "/admin/lots/new");
  });

  test("new sale wizard at mobile has no serious axe violations in main", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await assertMainContentA11y(page, "/admin/sales/new");
  });

  test("payments list at mobile has no serious axe violations in main", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await assertMainContentA11y(page, "/admin/payments");
  });

  test("clients preview drawer at mobile has no serious axe violations", async ({ page }) => {
    await page.setViewportSize(mobileViewport);
    await page.goto(`/admin/clients?client=${seededStaffRoutes.clientDetail}`);
    await expect(
      page.getByRole("dialog").filter({ hasText: /Robert Thorne|Overview/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousAxeViolationsInDialog(page);
  });

  test("legal entities preview drawer passes serious axe checks", async ({ page }) => {
    await page.goto(`/admin/legal-entities?entity=${seededStaffRoutes.legalEntityDrawer}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSeriousAxeViolationsInDialog(page);
  });

  test("source of funds detail evidence review passes serious axe checks", async ({ page }) => {
    await page.goto(`/admin/compliance/source-of-funds/${seededStaffRoutes.sofCaseDetail}`);
    await expect(page.getByRole("heading", { name: /evidence review/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});
