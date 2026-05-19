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

  test("staff list has accessible data table", async ({ page }) => {
    test.skip(!enabled || !staffEmail, skipReason);
    await staffLogin(page);
    await page.goto("/admin/staff");
    await expect(page.getByRole("table", { name: /staff directory/i })).toBeVisible();
  });
});
