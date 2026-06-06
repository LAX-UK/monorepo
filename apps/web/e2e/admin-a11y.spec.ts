import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web (pnpm dev).";

const staffEmail = process.env.PLAYWRIGHT_STAFF_EMAIL ?? "";
const staffPassword = process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "";

async function staffLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(staffEmail);
  await page.getByLabel(/password/i).fill(staffPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(admin|dashboard)/);
}

function formatAxeViolations(
  violations: ReadonlyArray<{ id: string; impact?: string | null; help: string }>,
) {
  return violations.map((v) => `  - ${v.id} (${v.impact ?? "?"}): ${v.help}`).join("\n");
}

async function expectNoSeriousAxeViolationsInMain(page: import("@playwright/test").Page) {
  const axe = await new AxeBuilder({ page })
    .include("#main-content")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = axe.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
  expect(
    blocking,
    blocking.length ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
  ).toHaveLength(0);
}

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

  test("conveyor hub has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/conveyor");
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
    await page.goto("/admin/payments/manual-review");
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

  test("analytics report hub has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/analytics");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });

  test("onsite events hub has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/onsite-events");
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

  test("payments list at mobile has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/payments");
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});
