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
// Sale setup wizard
// ---------------------------------------------------------------------------

test.describe("admin sale setup wizard", () => {
  test("new sale page shows setup wizard step 1", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/sales/new");
    await expect(page.getByRole("heading", { name: /new sale|set up sale/i })).toBeVisible();
    await expect(page.getByText(/step 1 of 6/i)).toBeVisible();
    await expect(page.getByLabel(/title/i).first()).toBeVisible();
  });

  test("draft sale setup page loads for existing sale", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/sales");
    const draftLink = page.getByRole("link", { name: /draft/i }).first();
    const hasDraft = await draftLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasDraft) {
      test.skip(true, "No draft sales in seed data");
      return;
    }
    await page.locator("table tbody tr").first().getByRole("link").first().click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);
    const setupLink = page.getByRole("link", { name: /continue setup/i });
    if (await setupLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await setupLink.click();
      await page.waitForURL(/\/admin\/sales\/[^/]+\/setup/);
      await expect(page.getByText(/step \d of 6/i)).toBeVisible();
    }
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

    await page.getByLabel(/title/i).first().fill(`E2E Test Lot ${Date.now()}`);
    await page.getByRole("button", { name: /continue/i }).click();

    const saleSelect = page.getByLabel(/assign to sale/i);
    await saleSelect.waitFor();
    const saleOptions = saleSelect.locator("option:not([disabled])");
    if ((await saleOptions.count()) === 0) {
      test.skip(true, "No sales available in seed data");
      return;
    }
    await saleSelect.selectOption({ index: 1 });

    const sellerSearch = page.getByPlaceholder(/search by organisation/i);
    await sellerSearch.click();
    await page.waitForTimeout(400);
    const sellerHit = page.locator(".absolute.z-20").getByRole("button").first();
    const hasSeller = await sellerHit.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasSeller) {
      test.skip(true, "No legal entities available in seed data");
      return;
    }
    await sellerHit.click();

    await page.getByRole("button", { name: /continue/i }).click();

    await page
      .getByLabel(/starting price/i)
      .first()
      .fill("100");

    const categoryTrigger = page.getByRole("button", { name: /select categories/i });
    if (await categoryTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await categoryTrigger.click();
      await page.getByRole("option").first().click();
    }

    await page.getByRole("button", { name: /create draft/i }).click();

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
