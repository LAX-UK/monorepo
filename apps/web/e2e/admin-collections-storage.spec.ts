import { type Page, type TestInfo, expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";
import { COLLECTION_JOURNEY_IDS, shoot, staffDayText } from "./helpers/collection-journeys";

/**
 * Finance and Admins set a place's storage terms on Collections › Storage
 * (docs/design/storage-terms.md, "Staff screens"): the tab with charging off, the side sheet with
 * its errors and the "Buyers will read" preview, a scheduled change beside the terms in force,
 * and cancelling it with a reason. Each state is shot at 1440 and 375 wide, light and dark.
 */

const storageTab = `/admin/collections?tab=storage&venue=${COLLECTION_JOURNEY_IDS.venue}`;

const SIZES = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;

/** The London day after today, as the date field takes it. */
function tomorrowInLondon(): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const next = new Date(`${today}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** One picture per size and scheme, full page, so the stacked cards show at 375. */
async function shootAll(page: Page, testInfo: TestInfo, name: string) {
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await shoot(page, testInfo, `storage-${name}-${size.name}-${scheme}`);
    }
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

/** A change left by an earlier run would stop a new one being scheduled: cancel it first. */
async function cancelWaitingChange(page: Page) {
  const scheduled = page.getByRole("region", { name: "Scheduled" });
  if ((await scheduled.count()) === 0) return;
  await scheduled.getByRole("button", { name: "Cancel change" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Left by an earlier test run");
  await dialog.getByRole("button", { name: "Cancel change" }).click();
  await expect(scheduled).toHaveCount(0);
}

test.describe("collections storage terms @journey", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);
  test.describe.configure({ retries: 0 });

  test("shows the terms, schedules a change from tomorrow, and cancels it with a reason", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(storageTab);
    await expect(page.getByRole("heading", { level: 1, name: "Collections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Storage" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await cancelWaitingChange(page);

    await test.step("the tab says charging is off, in the header and the notice", async () => {
      await expect(page.locator("header").getByText("Charging off")).toBeVisible();
      await shootAll(page, testInfo, "1-tab");
    });

    await test.step("the sheet lists what to fix, linked to each field", async () => {
      const open = page.getByRole("button", { name: /^(Schedule a change|Set storage terms)$/ });
      await open.click();
      const sheet = page.getByRole("dialog", { name: "Schedule a change" });
      await sheet.getByRole("textbox", { name: /^Free days/ }).fill("91");
      await sheet.getByRole("button", { name: "Schedule change" }).click();
      await expect(sheet.getByText("3 things to fix")).toBeVisible();
      await expect(sheet.getByRole("link", { name: "Choose a date from tomorrow" })).toBeVisible();
      await shootAll(page, testInfo, "2-sheet-errors");
    });

    await test.step("the preview reads as buyers will, and the change is scheduled", async () => {
      const sheet = page.getByRole("dialog", { name: "Schedule a change" });
      await sheet
        .getByRole("textbox", { name: /^Starts on/ })
        .fill(staffDayText(tomorrowInLondon()));
      await sheet.getByRole("textbox", { name: /^Reason/ }).fill("Rates for the new year");
      await sheet.getByRole("textbox", { name: /^Free days/ }).fill("14");
      await sheet.getByRole("textbox", { name: /^Standard/ }).fill("3.50");
      await sheet.getByRole("textbox", { name: /^Large/ }).fill("7.00");
      await expect(
        sheet
          .getByRole("note", { name: "Buyers will read" })
          .getByText(/After that it is £3\.50 a day for each work/),
      ).toBeVisible();
      await shootAll(page, testInfo, "3-sheet-preview");
      await sheet.getByRole("button", { name: "Schedule change" }).click();
      await expect(sheet).toHaveCount(0);
      const scheduled = page.getByRole("region", { name: "Scheduled" });
      await expect(scheduled).toContainText("Rates for the new year");
      await expect(page.getByRole("region", { name: "History" })).toContainText(
        "Scheduled new terms from",
      );
      await shootAll(page, testInfo, "4-scheduled");
    });

    await test.step("cancelling asks first, with a reason, and keeps it in History", async () => {
      const scheduled = page.getByRole("region", { name: "Scheduled" });
      await scheduled.getByRole("button", { name: "Cancel change" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: /^Cancel the change from/ })).toBeVisible();
      await shootAll(page, testInfo, "5-cancel-confirm");
      await dialog.getByRole("textbox").fill("Not needed this year");
      await dialog.getByRole("button", { name: "Cancel change" }).click();
      await expect(scheduled).toHaveCount(0);
      await expect(page.getByRole("region", { name: "History" })).toContainText(
        "Reason: Not needed this year",
      );
    });
  });
});
