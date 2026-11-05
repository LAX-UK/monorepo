/**
 * Submission wizard mobile E2E (iPhone).
 *
 * Requires:
 *   PLAYWRIGHT_E2E=1
 *   PLAYWRIGHT_BASE_URL
 *   PLAYWRIGHT_CLIENT_EMAIL / PLAYWRIGHT_CLIENT_PASSWORD
 *   Optional: PLAYWRIGHT_DRAFT_SUBMISSION_ID (UUID) — otherwise uses first draft link on list
 *
 * Run: PLAYWRIGHT_E2E=1 pnpm --filter @auction/web test:e2e -- e2e/submission-wizard-mobile.spec.ts
 */
import { expect, test } from "@playwright/test";
import { clientSession } from "./helpers/auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web (pnpm dev).";

const clientEmail = process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "";
const clientPassword = process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "";
const draftId = process.env.PLAYWRIGHT_DRAFT_SUBMISSION_ID ?? "";

test.describe("submission wizard mobile @journey", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("Next on Details step advances to Photos without leaving the wizard", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !clientEmail || !clientPassword,
      "Set PLAYWRIGHT_CLIENT_EMAIL and PLAYWRIGHT_CLIENT_PASSWORD",
    );

    await clientSession(page);

    if (draftId) {
      await page.goto(`/selling/consignments/${draftId}`);
    } else {
      // The seed has no draft for this account, so the wizard opens from a new submission.
      await page.goto("/selling/new");
      // Someone who can sell for more than one account chooses who is selling first.
      const toWork = page.getByTestId("sell-flow-continue");
      const basics = page.getByTestId("submission-wizard-step-basics");
      await expect(toWork.or(basics).first()).toBeVisible({ timeout: 15_000 });
      if (await toWork.isVisible()) await toWork.click();
    }

    await expect(page.getByTestId("submission-wizard-step-basics")).toBeVisible({
      timeout: 15_000,
    });

    const bottomNav = page.getByRole("navigation", {
      name: /primary mobile dashboard navigation/i,
    });
    await expect(bottomNav).toHaveCount(0);

    // A new submission starts empty, and each step is checked before the next opens. The form
    // may still be hydrating when the first key is typed, so an entry counts once it has stuck.
    const title = page.getByRole("textbox", { name: "Title", exact: true });
    const year = page.getByRole("textbox", { name: "Year of work", exact: true });
    await expect(async () => {
      await title.fill("Harbour study");
      await year.fill("2024");
      await expect(title).toHaveValue("Harbour study");
      await expect(year).toHaveValue("2024");
    }).toPass({ timeout: 15_000 });
    await page.getByRole("button", { name: /select categories/i }).click();
    await page.getByRole("option").first().click();
    await page.keyboard.press("Escape");

    await page.getByTestId("wizard-next").click();
    await expect(page.getByTestId("submission-wizard-step-details")).toBeVisible();

    await page
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("A small oil study, signed lower right, from a private collection.");

    const urlBefore = page.url();
    await page.getByTestId("wizard-next").click();

    await expect(page.getByTestId("submission-wizard-step-photos")).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toBe(urlBefore);
    await expect(page.getByText(/draft saved/i)).not.toBeVisible();
  });
});
