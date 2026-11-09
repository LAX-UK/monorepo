import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";
import {
  COLLECTION_JOURNEY_IDS,
  COLLECTION_JOURNEY_NAMES,
  COLLECTION_JOURNEY_REFERENCES,
  collectionJourneyVisits,
  shoot,
  staffDayText,
  workday,
} from "./helpers/collection-journeys";

/**
 * Staff at the Collections desk hand works over after a photo ID check, mark a visit nobody came
 * to as not collected, and book a missed visit again. The seed placed a visit in each state, with
 * fixed references, so each step finds its own.
 */

const venue = COLLECTION_JOURNEY_IDS.venue;
const refs = COLLECTION_JOURNEY_REFERENCES;
const { buyer, collector } = COLLECTION_JOURNEY_NAMES;
const visits = collectionJourneyVisits(new Date());

const day = (date: string) => `/admin/collections?venue=${venue}&date=${date}`;
const row = (page: import("@playwright/test").Page, reference: string) =>
  page.locator(`[data-booking="${reference}"]`);

test.describe("collections desk journey @journey @roles", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);
  // The journey hands over, closes and rebooks visits, so a retry would start from changed visits.
  test.describe.configure({ retries: 0 });

  test("shows a day, hands over after the ID check, marks a no-show and rebooks a missed visit", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);

    await test.step("a day shows its visits by time, with what each is ready for", async () => {
      await page.goto(day(visits.toHandOver.day));
      await expect(page.getByRole("heading", { level: 1, name: "Collections" })).toBeVisible();
      await expect(row(page, refs.toHandOver)).toContainText(buyer);
      await expect(row(page, refs.toHandOver)).toContainText("All released");
      await expect(row(page, refs.unreleased)).toContainText("Release first");
      await expect(page.getByRole("button", { name: "Book for a client" })).toBeVisible();
      await shoot(page, testInfo, "desk-1-day");
    });

    await test.step("a lot that is not released cannot be handed over, and says why", async () => {
      await row(page, refs.unreleased).getByRole("button", { name: "Hand over" }).click();
      const panel = page.getByRole("dialog");
      await expect(panel.getByRole("heading", { name: `Hand over to ${collector}` })).toBeVisible();
      await expect(panel.getByText("Release first").first()).toBeVisible();
      await expect(panel.getByRole("button", { name: /^Mark .* collected$/ })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await shoot(page, testInfo, "desk-2-release-first");
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
    });

    await test.step("hands over after the photo ID is checked, then the visit reads collected", async () => {
      await row(page, refs.toHandOver).getByRole("button", { name: "Hand over" }).click();
      const panel = page.getByRole("dialog");
      await expect(panel.getByText(COLLECTION_JOURNEY_NAMES.lots.toHandOver)).toBeVisible();

      // Without the check, it says what is missing.
      await panel.getByRole("button", { name: /^Mark .* collected$/ }).click();
      await expect(
        panel.getByText("Tick this once you've checked their ID.").first(),
      ).toBeVisible();
      await shoot(page, testInfo, "desk-3-id-errors");

      await panel.getByRole("checkbox", { name: /I checked photo ID/ }).click();
      await panel.getByRole("combobox", { name: /Type of ID/ }).click();
      await page.getByRole("option", { name: "Passport" }).click();
      await shoot(page, testInfo, "desk-4-ready-to-hand-over");
      await panel.getByRole("button", { name: /^Mark .* collected$/ }).click();

      await expect(page.getByText(new RegExp(`collected by ${collector}`))).toBeVisible({
        timeout: 20_000,
      });
      await expect(row(page, refs.toHandOver)).toContainText("Collected", { timeout: 20_000 });
      await expect(
        row(page, refs.toHandOver).getByRole("button", { name: "Undo hand-over" }),
      ).toBeVisible();
      await shoot(page, testInfo, "desk-5-handed-over");
    });

    await test.step("marks a visit nobody came to as not collected", async () => {
      await page.goto(day(visits.noShow.day));
      await expect(row(page, refs.noShow)).toContainText("Booked");
      await expect(row(page, refs.collected)).toContainText("Collected");
      await row(page, refs.noShow).getByRole("button", { name: "Not collected" }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: `Mark ${buyer}'s collection as not collected?` }),
      ).toBeVisible();
      await shoot(page, testInfo, "desk-6-not-collected-confirm");
      await dialog.getByRole("button", { name: "Mark not collected" }).click();
      await expect(row(page, refs.noShow)).toContainText("Not collected", { timeout: 20_000 });
      await shoot(page, testInfo, "desk-7-marked-not-collected");
    });

    await test.step("lists the missed visits, and books one again for another day", async () => {
      await page.goto(`/admin/collections?tab=not_collected&venue=${venue}`);
      await expect(row(page, refs.missed)).toContainText(buyer);
      await expect(row(page, refs.noShow)).toBeVisible();
      await shoot(page, testInfo, "desk-8-missed-visits");

      await row(page, refs.missed).getByRole("button", { name: "Rebook" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: `Rebook ${buyer}` })).toBeVisible();

      const wanted = workday(visits.toHandOver.day, 1);
      const dayField = dialog.getByLabel("Day");
      await dayField.fill(staffDayText(wanted));
      await dayField.press("Tab");
      const times = dialog.getByRole("radiogroup", { name: "Time" });
      await expect(times.getByRole("radio").first()).toBeVisible({ timeout: 20_000 });
      await times.getByRole("radio").first().click();
      await shoot(page, testInfo, "desk-9-rebook");

      await dialog.getByRole("button", { name: /^Rebook for / }).click();
      await expect(page.getByText(`${buyer} booked for`)).toBeVisible({ timeout: 20_000 });
      await expect(row(page, refs.missed)).toHaveCount(0, { timeout: 20_000 });
      await shoot(page, testInfo, "desk-10-rebooked");
    });
  });
});
