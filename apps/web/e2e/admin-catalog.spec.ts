/**
 * Catalog admin E2E happy paths.
 *
 * Requires:
 *   PLAYWRIGHT_E2E=1
 *   PLAYWRIGHT_BASE_URL pointing to a running dev instance
 *   PLAYWRIGHT_STAFF_EMAIL / PLAYWRIGHT_STAFF_PASSWORD for a seeded staff account
 *
 * Run: PLAYWRIGHT_E2E=1 pnpm --filter @auction/web test:e2e -- e2e/admin-catalog.spec.ts
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

// ---------------------------------------------------------------------------
// Admin catalog navigation smoke test
// ---------------------------------------------------------------------------

test.describe("admin catalog navigation", () => {
  test("lots list page loads", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/lots");
    await expect(page.getByRole("heading", { name: /lots/i })).toBeVisible();
  });

  test("sales list page loads", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/sales");
    await expect(page.getByRole("heading", { name: /sales/i })).toBeVisible();
  });

  test("categories list page loads", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/categories");
    await expect(page.getByRole("heading", { name: /categories/i })).toBeVisible();
  });

  test("artists list page loads", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/artists");
    await expect(page.getByRole("heading", { name: /artists/i })).toBeVisible();
  });

  test("submissions queue page loads", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/submissions");
    await expect(page.getByRole("heading", { name: /submissions/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Lot create flow
// ---------------------------------------------------------------------------

test.describe("admin lot create flow", () => {
  test("can navigate to new lot form and submit minimal draft", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/lots/new");
    await expect(page.getByRole("heading", { name: /new lot/i })).toBeVisible();

    const titleInput = page.getByLabel(/title/i).first();
    await titleInput.fill(`E2E Test Lot ${Date.now()}`);

    // Starting price
    const priceInput = page.getByLabel(/starting price/i).first();
    await priceInput.fill("100");

    await page.getByRole("button", { name: /save/i }).click();

    // Should redirect to lot detail
    await page.waitForURL(/\/admin\/lots\/[^/]+$/);
    await expect(page.getByText(/draft/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Category create flow
// ---------------------------------------------------------------------------

test.describe("admin category create flow", () => {
  test("can navigate to new category form and create", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/categories/new");

    const nameInput = page.getByLabel(/name/i).first();
    await nameInput.fill(`E2E Test Category ${Date.now()}`);

    const slugInput = page.getByLabel(/slug/i).first();
    await slugInput.fill(`e2e-test-cat-${Date.now()}`);

    await page.getByRole("button", { name: /save|create/i }).click();

    // Should redirect to categories list or edit page
    await expect(page).toHaveURL(/\/admin\/categories/);
  });
});

// ---------------------------------------------------------------------------
// Submission approve flow
// ---------------------------------------------------------------------------

test.describe("admin submission review flow", () => {
  test("submission detail page loads and shows status badge", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/submissions");

    // If there are submissions, click the first one
    const firstLink = page.getByRole("link", { name: /view/i }).first();
    const hasRows = await firstLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasRows) {
      test.skip();
      return;
    }

    await firstLink.click();
    await page.waitForURL(/\/admin\/submissions\/[^/]+$/);

    // Should show a status badge
    await expect(
      page.getByText(/submitted|under review|approved|rejected|draft|withdrawn|converted/i).first(),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Artist review flow
// ---------------------------------------------------------------------------

test.describe("admin artist review flow", () => {
  test("artist detail page loads with audit timeline link", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/artists");

    const firstLink = page
      .getByRole("link")
      .filter({ hasText: /view|edit/i })
      .first();
    const hasRows = await firstLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasRows) {
      test.skip();
      return;
    }

    // Navigate to first artist detail
    await page.goto("/admin/artists");
    const artistLink = page.locator("table tbody tr").first().getByRole("link").first();
    if (!(await artistLink.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await artistLink.click();
    await page.waitForURL(/\/admin\/artists\/[^/]+$/);

    // Audit timeline link should be scoped
    const auditLink = page.getByRole("link", { name: /audit timeline/i });
    await expect(auditLink).toBeVisible();
    const href = await auditLink.getAttribute("href");
    expect(href).toMatch(/aggregateType=artist/);
    expect(href).toMatch(/aggregateId=/);
  });
});
