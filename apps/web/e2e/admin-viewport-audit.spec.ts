import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials, seededStaffRoutes } from "./helpers/auth";
import { staffViewportDetailRoutes, staffViewportListRoutes } from "./helpers/staff-routes";

const VIEWPORTS = [
  { width: 390, height: 844, label: "mobile" },
  { width: 1023, height: 900, label: "constrained-desktop" },
  { width: 1440, height: 1000, label: "desktop" },
] as const;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const wider = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth + 1) return [];
    // Name the widest elements past the edge, so a failure says what scrolls the page.
    // An element inside a box that scrolls on its own (a stepper, a table) does not widen the page.
    const scrollsInside = (el: Element) => {
      for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
        const clips = getComputedStyle(box).overflowX !== "visible";
        if (clips && box.getBoundingClientRect().right <= doc.clientWidth + 1) return true;
      }
      return false;
    };
    return [...document.body.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1 && !scrollsInside(el))
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute("class")).slice(0, 90)}`);
  });
  expect(wider, `${page.url()} scrolls sideways`).toEqual([]);
}

/** Bid admin work-queue panels: each opens from its first row, by the record link every row carries. */
const QUEUE_PANELS = [
  { name: "onboarding issues (KYC tab)", path: "/admin/onboarding-issues?tab=kyc", param: "item" },
  { name: "AML screening", path: "/admin/compliance/aml", param: "screening" },
  { name: "payments", path: "/admin/payments", param: "payment" },
  {
    name: "held payments / manual review",
    path: "/admin/payments?manualReview=1",
    param: "payment",
  },
  { name: "lot fulfilment", path: "/admin/lot-fulfilment", param: "lot" },
  { name: "condition reports", path: "/admin/condition-reports", param: "request" },
  { name: "invitations", path: "/admin/invitations", param: "invitation" },
  { name: "audit", path: "/admin/audit", param: "event" },
  { name: "payouts", path: "/admin/payouts", param: "payout" },
] as const;

test.describe("admin viewport audit @a11y", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);

  for (const viewport of VIEWPORTS) {
    test(`${viewport.label} — no horizontal overflow on staff list routes`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const path of staffViewportListRoutes) {
        const response = await page.goto(path);
        expect(response?.ok()).toBeTruthy();
        await page.locator("#main-content").waitFor({ state: "visible" });
        await assertNoHorizontalOverflow(page);
      }
    });

    test(`${viewport.label} — no horizontal overflow on staff detail routes`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const path of staffViewportDetailRoutes) {
        const response = await page.goto(path);
        expect(response?.ok()).toBeTruthy();
        await page.locator("#main-content").waitFor({ state: "visible" });
        await assertNoHorizontalOverflow(page);
      }
    });
  }

  test("mobile preview drawers do not overflow horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/admin/payouts?payout=${seededStaffRoutes.payoutDrawer}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("mobile legal entity page from an old panel link does not overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/legal-entities?entity=${seededStaffRoutes.legalEntityDrawer}`);
    await expect(page.getByRole("heading", { name: "Organisation readiness" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("mobile filters sheet on lots list does not overflow horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/lots");
    await page.getByRole("button", { name: /^filter\b/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  // A long, unbreakable value (email, reference) in a panel header must not widen the phone.
  for (const queue of QUEUE_PANELS) {
    test(`mobile ${queue.name} panel does not overflow horizontally`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(queue.path);
      await page.locator("#main-content").waitFor({ state: "visible" });
      await assertNoHorizontalOverflow(page);
      // The list may also hold a desktop-only copy of the link; a phone user taps the visible one.
      const links = page.locator(`a[href*="${queue.param}="]`);
      test.skip((await links.count()) === 0, `The seeded ${queue.name} queue is empty`);
      const link = links.locator("visible=true").first();
      await expect(link, `${queue.name} has a link a phone user can tap`).toBeVisible();
      await link.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`[?&]${queue.param}=`));
      await assertNoHorizontalOverflow(page);
      const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${queue.name} dialog scrolls sideways`).toBeLessThanOrEqual(1);
    });
  }
});
