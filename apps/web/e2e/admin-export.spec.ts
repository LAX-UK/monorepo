/**
 * Admin export E2E happy path.
 *
 * Requires:
 *   PLAYWRIGHT_E2E=1
 *   PLAYWRIGHT_BASE_URL pointing to a running dev instance
 *   PLAYWRIGHT_STAFF_EMAIL / PLAYWRIGHT_STAFF_PASSWORD for a seeded staff account
 *
 * Run: PLAYWRIGHT_E2E=1 pnpm --filter @auction/web test:e2e -- e2e/admin-export.spec.ts
 */
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
  await page.waitForURL(/dashboard/);
}

test.describe("admin export flow", () => {
  test("lots export opens confirm sheet and starts download or async job", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/lots");

    await expect(page.getByRole("heading", { name: /lots/i })).toBeVisible();

    const exportResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/exports") &&
        res.request().method() === "POST" &&
        !res.url().includes("/preview"),
    );

    await page.getByRole("button", { name: /^export$/i }).click();
    await page.getByRole("menuitem", { name: /csv/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /download csv|start export/i }).click();

    const res = await exportResponse;
    expect([200, 202]).toContain(res.status());

    const contentType = res.headers()["content-type"] ?? "";
    if (contentType.includes("text/csv")) {
      expect(res.status()).toBe(200);
    } else {
      const body = (await res.json()) as { mode: string };
      expect(["async", "existing"]).toContain(body.mode);
    }
  });
});
