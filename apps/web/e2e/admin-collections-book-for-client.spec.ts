import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";
import {
  COLLECTION_JOURNEY_IDS,
  COLLECTION_JOURNEY_NAMES,
  COLLECTION_JOURNEY_REFERENCES,
  seededVisitDay,
  shoot,
  staffDayText,
  workday,
} from "./helpers/collection-journeys";

/**
 * Staff book a visit at the Collections desk for a client who phoned in. The seed left one of
 * Northbank Gallery's paid lots free (the one from its cancelled visit, which the buyer journey
 * only reads), so the desk books that lot and the new visit shows on the Day tab.
 */

const venue = COLLECTION_JOURNEY_IDS.venue;
const { buyer, collector } = COLLECTION_JOURNEY_NAMES;
const lot = COLLECTION_JOURNEY_NAMES.lots.cancelled;

test.describe("collections desk book for a client journey @journey", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);
  // The journey books a visit, so a retry would find the lot already booked.
  test.describe.configure({ retries: 0 });

  test("books a visit for a client's paid lot and finds it on the Day tab", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    // Two working days on from the seeded visits, so it never meets the desk journey's rebook.
    const wanted = workday(await seededVisitDay(COLLECTION_JOURNEY_REFERENCES.toHandOver), 2);

    await page.goto(`/admin/collections?venue=${venue}&date=${wanted}`);
    await expect(page.getByRole("heading", { level: 1, name: "Collections" })).toBeVisible();

    const dialog = page.getByRole("dialog");
    await test.step("opens the form and chooses the client, whose paid lots are listed", async () => {
      await page.getByRole("button", { name: "Book for a client" }).click();
      await expect(dialog.getByRole("heading", { name: "Book for a client" })).toBeVisible();
      await dialog.getByRole("combobox", { name: /Client/ }).click();
      await page.getByPlaceholder("Search clients").fill(buyer);
      await page
        .getByRole("option", { name: new RegExp(buyer) })
        .first()
        .click();
      await expect(dialog.getByRole("checkbox", { name: new RegExp(lot) })).toBeVisible({
        timeout: 20_000,
      });
      // Every lot that can be collected starts ticked, and which others can be depends on what
      // the other journeys have done: leave only this one.
      for (const box of await dialog
        .getByRole("checkbox", { name: /Collection journey: / })
        .all()) {
        if (await box.isEnabled()) await box.setChecked(false);
      }
      await dialog.getByRole("checkbox", { name: new RegExp(lot) }).check();
      await shoot(page, testInfo, "desk-book-1-client-and-lot");
    });

    await test.step("chooses a day and time and who collects", async () => {
      const dayField = dialog.getByLabel("Day");
      await dayField.fill(staffDayText(wanted));
      await dayField.press("Tab");
      const times = dialog.getByRole("radiogroup", { name: "Time" });
      await expect(times.getByRole("radio").first()).toBeVisible({ timeout: 20_000 });
      await times.getByRole("radio").first().click();
      await dialog.getByLabel("Name on their photo ID").fill(collector);
      await shoot(page, testInfo, "desk-book-2-time-and-collector");
    });

    await test.step("books it, and the visit is on the Day tab", async () => {
      await dialog.getByRole("button", { name: "Book for a client" }).click();
      await expect(page.getByText(/^Booked for /)).toBeVisible({ timeout: 20_000 });
      await expect(dialog).toHaveCount(0);

      await page.goto(`/admin/collections?venue=${venue}&date=${wanted}`);
      const booked = page.locator("[data-booking]").filter({ hasText: lot });
      await expect(booked).toHaveCount(1, { timeout: 20_000 });
      await expect(booked).toContainText(buyer);
      await expect(booked).toContainText("Booked");
      await shoot(page, testInfo, "desk-book-3-on-the-day-tab");
    });
  });
});
