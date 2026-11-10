import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  COLLECTION_JOURNEY_IDS,
  COLLECTION_JOURNEY_NAMES,
  COLLECTION_JOURNEY_REFERENCES,
  shoot,
} from "./helpers/collection-journeys";
import {
  ORGANISATION_JOURNEY_NAMES,
  expectActingAs,
  openAs,
} from "./helpers/organisation-journeys";

/**
 * The owner of Northbank Gallery books a time to collect paid lots, moves a visit to another time
 * and cancels another. Every lot here is paid and released, and the seed placed the visits so a
 * change is still allowed (the cut-off is 16:00 the working day before).
 */

const { approved } = ORGANISATION_JOURNEY_NAMES;
const lots = COLLECTION_JOURNEY_NAMES.lots;

test.describe("buyer collection journey @journey @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);
  // The journey books, moves and cancels visits, so a retry would start from changed visits.
  test.describe.configure({ retries: 0 });

  test("books a time, moves a visit and cancels another", async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.setTimeout(240_000);
    const owner = await openAs(browser, roleAuthState.buyer, approved, baseURL);
    const { page } = owner;

    await test.step("books a time for a paid lot", async () => {
      await page.goto(`/purchases/collect?lots=${COLLECTION_JOURNEY_IDS.lotToBook}`);
      await expectActingAs(page, approved, "Owner");
      await expect(
        page.getByRole("heading", { level: 1, name: "Book a collection" }),
      ).toBeVisible();
      await expect(page.getByText(lots.toBook).first()).toBeVisible();
      // Every lot that can be booked is ticked to begin with: leave only this one.
      for (const title of [lots.missed, lots.partlyLeft, lots.cancelled]) {
        await page.getByRole("checkbox", { name: new RegExp(title) }).uncheck();
      }
      await shoot(page, testInfo, "buyer-1-choose-lots");

      // The first day with times, then its first time.
      const days = page.getByRole("radiogroup", { name: /^Day/ });
      await days
        .getByRole("radio", { name: /times?$/ })
        .first()
        .click();
      const times = page.getByRole("radiogroup", { name: "Time" });
      await expect(times.getByRole("radio").first()).toBeVisible();
      await times.getByRole("radio", { disabled: false }).first().click();
      await shoot(page, testInfo, "buyer-2-time-chosen");

      await page.getByRole("button", { name: "Confirm booking" }).click();
      await expect(page.getByText(/^Collection booked for /)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Reference COL-\d+/)).toBeVisible();
      await expect(
        page.getByText("We've emailed the details and a calendar invite."),
      ).toBeVisible();
      await shoot(page, testInfo, "buyer-3-booked");
    });

    await test.step("lists the visits, to come first, and the earlier ones", async () => {
      await page.goto("/purchases/collect");
      await expect(page.getByRole("heading", { level: 2, name: "Upcoming" })).toBeVisible();
      await expect(page.getByRole("article").filter({ hasText: lots.toBook })).toBeVisible();
      await expect(
        page.getByRole("article").filter({ hasText: COLLECTION_JOURNEY_REFERENCES.collected }),
      ).toContainText("Collected");
      await expect(
        page.getByRole("article").filter({ hasText: COLLECTION_JOURNEY_REFERENCES.cancelled }),
      ).toContainText("Cancelled");
      await shoot(page, testInfo, "buyer-4-visits");
    });

    await test.step("moves a booked visit to another time", async () => {
      const card = page
        .getByRole("article")
        .filter({ hasText: COLLECTION_JOURNEY_REFERENCES.toChange });
      await card.getByRole("link", { name: "Change time" }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Change your collection" }),
      ).toBeVisible();
      await expect(
        page.getByText("Your current time is kept until you confirm a new one."),
      ).toBeVisible();

      await page
        .getByRole("radiogroup", { name: /^Day/ })
        .getByRole("radio", { name: /times?$/ })
        .first()
        .click();
      const times = page.getByRole("radiogroup", { name: "Time" });
      await expect(times.getByRole("radio").first()).toBeVisible();
      await times.getByRole("radio", { disabled: false }).first().click();
      await shoot(page, testInfo, "buyer-5-change-time");

      await page.getByRole("button", { name: "Move booking" }).click();
      await expect(page.getByText(/^Collection moved to /)).toBeVisible({ timeout: 20_000 });
      await shoot(page, testInfo, "buyer-6-moved");
    });

    await test.step("cancels another booked visit, which frees its lot", async () => {
      await page.goto("/purchases/collect");
      const card = page
        .getByRole("article")
        .filter({ hasText: COLLECTION_JOURNEY_REFERENCES.toCancel });
      await card.getByRole("button", { name: "Cancel booking" }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: /^Cancel your collection on / }),
      ).toBeVisible();
      await expect(dialog).toContainText(
        "Your lots stay with us, paid and safe, until you book again.",
      );
      await shoot(page, testInfo, "buyer-7-cancel-dialog");

      await dialog.getByRole("button", { name: "Cancel booking" }).click();
      await expect(
        page.getByRole("article").filter({ hasText: COLLECTION_JOURNEY_REFERENCES.toCancel }),
      ).toContainText("Cancelled", { timeout: 20_000 });
      await shoot(page, testInfo, "buyer-8-cancelled");
    });

    await owner.close();
  });
});
