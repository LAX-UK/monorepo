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

test.describe("admin a11y smoke", () => {
  test("admin home has no serious axe violations in main", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin");
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

  test("staff list has accessible data table", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/staff");
    await expect(page.getByRole("table", { name: /staff directory/i })).toBeVisible();
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
});
