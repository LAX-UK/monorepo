import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  e2eEnabled as enabled,
  expectNoSeriousAxeViolationsInMain,
  formatAxeViolations,
  hasStaffCredentials,
  e2eSkipReason as skipReason,
  staffLogin,
} from "./helpers/auth";

const staffEmail = hasStaffCredentials() ? "configured" : "";

test.describe("admin a11y smoke", () => {
  test("admin home has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin");
    await expect(page.locator("#main-content")).toBeVisible();

    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("admin lots list has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/lots");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("admin sales list has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/sales");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("staff list has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/staff");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("submissions list at mobile has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/submissions");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("condition reports list at mobile has no serious axe violations in main", async ({
    page,
  }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/condition-reports");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("payment disputes list has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/disputes");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("payments list has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/payments");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("payouts list at mobile has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/payouts");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("AML compliance queue has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/compliance/aml");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("source of funds compliance queue at mobile has no serious axe violations in main", async ({
    page,
  }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/compliance/source-of-funds");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("source of funds case page main content is reachable from queue", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/compliance/source-of-funds");
    await expect(page.locator("#main-content")).toBeVisible();

    const reviewLink = page.getByRole("link", { name: /^review$/i }).first();
    if ((await reviewLink.count()) === 0) {
      test.skip(true, "No pending Source of Funds cases in this environment");
    }

    await reviewLink.click();
    await expect(page).toHaveURL(/\/admin\/compliance\/source-of-funds\/[^/]+$/);
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("source of funds evidence reviewer confirms before discarding unsaved review", async ({
    page,
  }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
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

  test("buyer source of funds page exposes progress landmarks", async ({ page }) => {
    test.skip(!enabled, skipReason);
    const buyerEmail = process.env.PLAYWRIGHT_BUYER_EMAIL ?? "";
    const buyerPassword = process.env.PLAYWRIGHT_BUYER_PASSWORD ?? "";
    test.skip(!buyerEmail, "Set PLAYWRIGHT_BUYER_EMAIL for buyer SoF a11y smoke");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(buyerEmail);
    await page.getByLabel(/password/i).fill(buyerPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(admin|dashboard)/);

    await page.goto("/dashboard/compliance/source-of-funds");
    if (!page.url().includes("/dashboard/compliance/source-of-funds")) {
      test.skip(true, "Buyer has no active Source of Funds case in this environment");
    }

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /source of funds verification/i }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: /verification progress/i })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1);

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("onboarding issues page has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/onboarding-issues");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("invitations page has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/invitations");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("lot fulfilment list at mobile has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/lot-fulfilment");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("finance hub has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/finance");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("saleroom hub has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/saleroom");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("manual review queue has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/payments?manualReview=1");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("clients list has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/clients");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("legal entities browse has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/legal-entities");
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(
      blocking,
      blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
    ).toHaveLength(0);
  });

  test("artists catalog browse has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/artists");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("categories catalog browse has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/categories");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("venues catalog browse has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/venues");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("event RSVPs hub has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/event-rsvps");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("xero integration page has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/integrations/xero");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("payout settlement page has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/payouts/settlement");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("lots attention lens has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/lots?lens=attention");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("new lot wizard at mobile has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/lots/new");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("new sale wizard at mobile has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/sales/new");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("payments list at mobile has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/payments");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});
