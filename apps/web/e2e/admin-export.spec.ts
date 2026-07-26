/**
 * Admin export E2E happy path.
 */
import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials, staffLogin } from "./helpers/auth";

test.describe("admin export flow", () => {
  test("lots export opens confirm sheet and starts download or async job", async ({ page }) => {
    test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);
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
