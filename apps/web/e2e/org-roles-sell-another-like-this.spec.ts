import { type Page, expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_IDS,
  ORGANISATION_JOURNEY_NAMES,
  openAs,
} from "./helpers/organisation-journeys";

/**
 * "Sell another like this": a consignor of Northbank Gallery starts the next work from one they
 * already consigned. The wizard opens with the shared facts filled in and the rest blank, and
 * nobody acting for another account can start from that work. Nothing is saved: a new work is
 * only written once it is saved or sent, so the seeded consignments stay as they are.
 */

const { approved, other } = ORGANISATION_JOURNEY_NAMES;
const { submissionUnsold } = ORGANISATION_JOURNEY_IDS;
const SOURCE_TITLE = "Quiet Tide, unsold";

/** Past "Selling as" when the person can sell for more than one account. */
async function toTheWork(page: Page) {
  const toWork = page.getByTestId("sell-flow-continue");
  const basics = page.getByTestId("submission-wizard-step-basics");
  await expect(toWork.or(basics).first()).toBeVisible({ timeout: 15_000 });
  if (await toWork.isVisible()) await toWork.click();
  await expect(basics).toBeVisible({ timeout: 15_000 });
}

test.describe("sell another like this @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("starts the next work from a consignment's row menu", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const consignor = await openAs(browser, roleAuthState.orgConsignor, approved, baseURL);
    const { page } = consignor;

    await test.step("opens the wizard from the row menu", async () => {
      await page.goto("/selling/consignments?tab=all");
      const cookies = page.getByRole("button", { name: "Accept all" });
      if (await cookies.isVisible().catch(() => false)) await cookies.click();
      await page.getByRole("button", { name: `More for ${SOURCE_TITLE}` }).click();
      await page.getByRole("menuitem", { name: "Sell another like this" }).click();
      await expect(page).toHaveURL(new RegExp(`/selling/new\\?copyFrom=${submissionUnsold}$`));
    });

    await test.step("names the work it started from", async () => {
      await expect(page.getByText(`Started from ${SOURCE_TITLE}.`, { exact: true })).toBeVisible();
      await expect(
        page.getByText("Check every step before you send it.", { exact: true }),
      ).toBeVisible();
    });

    await test.step("fills the shared facts and leaves the rest blank", async () => {
      await toTheWork(page);
      const title = page.getByRole("textbox", { name: "Title", exact: true });
      await expect(title).toHaveValue("");
      await expect(page.getByRole("textbox", { name: "Year of work", exact: true })).toHaveValue(
        "",
      );
      await expect(async () => {
        await title.fill("Quiet Tide II");
        await expect(title).toHaveValue("Quiet Tide II");
      }).toPass({ timeout: 15_000 });
      await page.getByRole("textbox", { name: "Year of work", exact: true }).fill("2020");
      await page.getByTestId("wizard-next").click();
      await expect(page.getByTestId("submission-wizard-step-details")).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Medium (optional)" })).toHaveValue(
        "Oil on canvas",
      );
      await expect(page.getByRole("textbox", { name: "Dimensions (optional)" })).toHaveValue("");
      await expect(page.getByRole("checkbox", { name: "The work is signed" })).toBeChecked();
      await expect(page.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("");
    });

    await consignor.close();
  });

  test("refuses another account's work as not found", async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    // The owner of Northbank, acting for Harrington Estate: the work is not that account's.
    const owner = await openAs(browser, roleAuthState.buyer, other, baseURL);
    const { page } = owner;
    await page.goto(`/selling/new?copyFrom=${submissionUnsold}`);
    await expect(page.getByRole("heading", { name: "That page doesn't exist" })).toBeVisible();
    await expect(page.getByText(/Started from/)).toHaveCount(0);
    await expect(page.getByTestId("submission-wizard-step-basics")).toHaveCount(0);
    await owner.close();
  });
});
