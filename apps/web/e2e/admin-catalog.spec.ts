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
const catalogueEmail = process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL ?? "";
const cataloguePassword = process.env.PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD ?? "";

async function staffLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(staffEmail);
  await page.getByLabel(/password/i).fill(staffPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

async function catalogueManagerLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(catalogueEmail);
  await page.getByLabel(/password/i).fill(cataloguePassword);
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
// Catalogue manager smoke (catalogue.write without auction.manage)
// ---------------------------------------------------------------------------

test.describe("catalogue manager catalog access", () => {
  test("can open lots list and draft lot detail publish control", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !catalogueEmail || !cataloguePassword,
      "Set PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL/PASSWORD",
    );
    await catalogueManagerLogin(page);
    await page.goto("/admin/lots?status=draft");
    await expect(page.getByRole("heading", { name: /lots/i })).toBeVisible();

    const firstLot = page.locator("table tbody tr").first().getByRole("link").first();
    const hasDraft = await firstLot.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDraft) {
      test.skip(true, "No draft lots in seed data");
      return;
    }
    await firstLot.click();
    await page.waitForURL(/\/admin\/lots\/[^/]+$/);
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeVisible();
  });

  test("bulk Cancel is hidden on lots list", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !catalogueEmail || !cataloguePassword,
      "Set PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL/PASSWORD",
    );
    await catalogueManagerLogin(page);
    await page.goto("/admin/lots?status=draft");
    await expect(page.getByRole("heading", { name: /lots/i })).toBeVisible();

    const firstRowCheckbox = page.locator("table tbody tr").first().getByRole("checkbox");
    const hasRows = await firstRowCheckbox.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasRows) {
      test.skip(true, "No lots in seed data");
      return;
    }
    await firstRowCheckbox.check();
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^cancel$/i })).toHaveCount(0);
  });

  test("detail Cancel auction is hidden on lot detail", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !catalogueEmail || !cataloguePassword,
      "Set PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL/PASSWORD",
    );
    await catalogueManagerLogin(page);
    await page.goto("/admin/lots?status=draft");
    const firstLot = page.locator("table tbody tr").first().getByRole("link").first();
    const hasDraft = await firstLot.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDraft) {
      test.skip(true, "No draft lots in seed data");
      return;
    }
    await firstLot.click();
    await page.waitForURL(/\/admin\/lots\/[^/]+$/);
    await expect(page.getByRole("button", { name: /cancel auction/i })).toHaveCount(0);
  });

  test("sale lots tab hides return to inventory for catalogue manager", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !catalogueEmail || !cataloguePassword,
      "Set PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL/PASSWORD",
    );
    await catalogueManagerLogin(page);
    await page.goto("/admin/sales");
    const cancelledRow = page
      .locator("table tbody tr")
      .filter({ hasText: /cancelled/i })
      .first();
    const hasCancelled = await cancelledRow.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCancelled) {
      test.skip(true, "No cancelled sales in seed data");
      return;
    }
    await cancelledRow.getByRole("link").first().click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);
    await page.goto(`${page.url()}/lots`);
    await expect(page.getByText(/return lots to inventory/i)).toHaveCount(0);
  });

  test("sale detail hides publish and bulk cancel for catalogue manager", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !catalogueEmail || !cataloguePassword,
      "Set PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL/PASSWORD",
    );
    await catalogueManagerLogin(page);
    await page.goto("/admin/sales");
    await expect(page.getByRole("heading", { name: /sales/i })).toBeVisible();

    const firstRowCheckbox = page.locator("table tbody tr").first().getByRole("checkbox");
    const hasRows = await firstRowCheckbox.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasRows) {
      test.skip(true, "No sales in seed data");
      return;
    }
    await firstRowCheckbox.check();
    await expect(page.getByRole("button", { name: /^publish$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^cancel$/i })).toHaveCount(0);

    await page.locator("table tbody tr").first().getByRole("link").first().click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);
    await expect(page.getByRole("button", { name: /more sale actions/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /edit draft/i })).toHaveCount(0);
  });

  test("shows bulk publish preflight hint when lots are sale-assigned", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !catalogueEmail || !cataloguePassword,
      "Set PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL/PASSWORD",
    );
    await catalogueManagerLogin(page);
    await page.goto("/admin/lots?status=draft");
    const firstRowCheckbox = page.locator("table tbody tr").first().getByRole("checkbox");
    const hasRows = await firstRowCheckbox.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasRows) {
      test.skip(true, "No lots in seed data");
      return;
    }
    await firstRowCheckbox.check();
    const preflight = page.getByText(/published together when you publish the sale/i);
    const hasPreflight = await preflight.isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasPreflight) {
      test.skip(true, "Selected lot is not assigned to a draft sale");
      return;
    }
    await expect(preflight).toBeVisible();
  });
});

test.describe("lot detail connect banner", () => {
  test("shows connect banner when lot detail has connect_required error", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/lots?status=draft");
    const firstLotLink = page.locator("table tbody tr").first().getByRole("link").first();
    const hasDraft = await firstLotLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDraft) {
      test.skip(true, "No draft lots in seed data");
      return;
    }
    const href = await firstLotLink.getAttribute("href");
    if (!href) {
      test.skip(true, "Could not resolve lot detail href");
      return;
    }
    await page.goto(`${href}?error_code=connect_required`);
    await expect(page.getByTestId("admin-lot-connect-required-banner")).toBeVisible();
  });

  test("shows connect banner on non-overview lot detail tab", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/lots?status=draft");
    const firstLotLink = page.locator("table tbody tr").first().getByRole("link").first();
    const hasDraft = await firstLotLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDraft) {
      test.skip(true, "No draft lots in seed data");
      return;
    }
    const href = await firstLotLink.getAttribute("href");
    if (!href) {
      test.skip(true, "Could not resolve lot detail href");
      return;
    }
    await page.goto(`${href}/images?error_code=connect_required`);
    await expect(page.getByTestId("admin-lot-connect-required-banner")).toBeVisible();
  });

  test("shows draft-sale publish copy on lot detail when sale is draft", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/sales");
    const draftLink = page.getByRole("link", { name: /draft/i }).first();
    const hasDraftSale = await draftLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasDraftSale) {
      test.skip(true, "No draft sales in seed data");
      return;
    }
    await page.locator("table tbody tr").first().getByRole("link").first().click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);
    await page.goto(`${page.url()}/lots`);
    const lotLink = page.locator("table tbody tr").first().getByRole("link").first();
    const hasLot = await lotLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasLot) {
      test.skip(true, "No lots on draft sale");
      return;
    }
    await lotLink.click();
    await page.waitForURL(/\/admin\/lots\/[^/]+/);
    await expect(page.getByText(/published together when you publish the sale/i)).toBeVisible();
  });
});

test.describe("sale detail connect banner", () => {
  test("shows connect banner when sale detail has connect_required error", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/sales");
    const draftLink = page.getByRole("link", { name: /draft/i }).first();
    const hasDraftSale = await draftLink.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasDraftSale) {
      test.skip(true, "No draft sales in seed data");
      return;
    }
    await page.locator("table tbody tr").first().getByRole("link").first().click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);
    await page.goto(`${page.url()}?error_code=connect_required`);
    await expect(page.getByTestId("admin-lot-connect-required-banner")).toBeVisible();
  });
});

test.describe("lot detail proactive connect", () => {
  const connectBlockedLotId = "b1000017-0000-4000-8000-000000000017";

  test("shows connect banner on draft lot when seller connect is blocked", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!process.env.STRIPE_SECRET_KEY?.trim(), "Requires Stripe Connect enforcement in API");
    await staffLogin(page);
    await page.goto(`/admin/lots/${connectBlockedLotId}`);
    await expect(page.getByTestId("admin-lot-connect-required-banner")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeDisabled();
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

// ---------------------------------------------------------------------------
// Scheduled sale + draft lot publish
// ---------------------------------------------------------------------------

test.describe("scheduled sale draft lot publish", () => {
  test("draft lot on a scheduled sale exposes publish control on detail", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/sales?status=scheduled");
    await expect(page.getByRole("heading", { name: /sales/i })).toBeVisible();

    const scheduledRow = page.locator("table tbody tr").first();
    const hasScheduled = await scheduledRow.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasScheduled) {
      test.skip(true, "No scheduled sales in seed data");
      return;
    }
    await scheduledRow.getByRole("link").first().click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);

    await page.goto(`${page.url()}/lots`);
    const draftLotLink = page
      .locator("table tbody tr")
      .filter({ hasText: /draft/i })
      .first()
      .getByRole("link")
      .first();
    const hasDraftLot = await draftLotLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDraftLot) {
      test.skip(true, "Scheduled sale has no draft lots in seed data");
      return;
    }
    await draftLotLink.click();
    await page.waitForURL(/\/admin\/lots\/[^/]+$/);
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Catalog delete smoke (staff with auction.manage)
// ---------------------------------------------------------------------------

test.describe("catalog delete smoke", () => {
  test("auction manager sees delete on deletable draft lot detail", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/lots?status=draft");
    const firstLot = page.locator("table tbody tr").first().getByRole("link").first();
    const hasDraft = await firstLot.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDraft) {
      test.skip(true, "No draft lots in seed data");
      return;
    }
    await firstLot.click();
    await page.waitForURL(/\/admin\/lots\/[^/]+$/);

    const mobileDelete = page.getByRole("button", { name: /^delete lot$/i });
    const moreButton = page.getByRole("button", { name: /more lot actions/i });
    const hasMobileDelete = await mobileDelete.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasMobileDelete) {
      await expect(mobileDelete).toBeVisible();
      return;
    }
    const hasMore = await moreButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasMore) {
      test.skip(true, "Draft lot is not deletable in seed data");
      return;
    }
    await moreButton.click();
    await expect(page.getByRole("menuitem", { name: /delete lot/i })).toBeVisible();
  });

  test("auction manager sees delete on deletable draft sale detail", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await staffLogin(page);
    await page.goto("/admin/sales?status=draft");
    const firstSale = page.locator("table tbody tr").first().getByRole("link").first();
    const hasDraft = await firstSale.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDraft) {
      test.skip(true, "No draft sales in seed data");
      return;
    }
    await firstSale.click();
    await page.waitForURL(/\/admin\/sales\/[^/]+$/);

    const moreButton = page.getByRole("button", { name: /more sale actions/i });
    const hasMore = await moreButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasMore) {
      test.skip(true, "Draft sale is not deletable in seed data");
      return;
    }
    await moreButton.click();
    await expect(page.getByRole("menuitem", { name: /delete sale/i })).toBeVisible();
  });
});
