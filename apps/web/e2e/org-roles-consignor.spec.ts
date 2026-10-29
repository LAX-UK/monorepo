import { type Page, expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_IDS,
  ORGANISATION_JOURNEY_NAMES,
  expectActingAs,
  expectNoAccess,
  openAs,
} from "./helpers/organisation-journeys";

/**
 * A consignor of Northbank Gallery sends the works they have prepared, answers a specialist who
 * asked for changes, and has no way into the team: the Members address gives the access page.
 *
 * Sending and resending are marked as known failures: the consignment page loses who sent a work
 * (the web submission schema drops `submittedByUserId`), so a consignor is refused their own
 * work and sees it read-only. Remove the `fixme` once the page keeps the sender.
 */

const { approved } = ORGANISATION_JOURNEY_NAMES;
const { submissionDraft, submissionNeedsChanges } = ORGANISATION_JOURNEY_IDS;

async function openConsignment(page: Page, id: string) {
  await page.goto(`/selling/consignments/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("organisation consignor journey @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("follows their works and cannot open the team", async ({ browser, baseURL }) => {
    const consignor = await openAs(browser, roleAuthState.orgConsignor, approved, baseURL);
    const { page } = consignor;

    await page.goto("/home");
    await expectActingAs(page, approved, "Consignor");

    await openConsignment(page, submissionDraft);
    await expect(
      page.getByRole("heading", { name: "Coastal Notation, ready to send" }),
    ).toBeVisible();

    await openConsignment(page, submissionNeedsChanges);
    await expect(page.getByTestId("changes-requested")).toContainText(
      "Please add a clearer photograph of the signature.",
    );

    await expectNoAccess(page, "/organisation/members");
    await expectNoAccess(page, "/purchases");
    await consignor.close();
  });

  test.fixme(
    "sends a complete draft to the specialist (consignor is refused their own work)",
    async ({ browser, baseURL }) => {
      const consignor = await openAs(browser, roleAuthState.orgConsignor, approved, baseURL);
      const { page } = consignor;
      await openConsignment(page, submissionDraft);
      const send = page.getByRole("button", { name: "Submit for specialist review" });
      await expect(send).toBeVisible();
      await send.click();
      await expect(send).toHaveCount(0);
      await consignor.close();
    },
  );

  test.fixme(
    "answers a request for changes (consignor is refused their own work)",
    async ({ browser, baseURL }) => {
      const consignor = await openAs(browser, roleAuthState.orgConsignor, approved, baseURL);
      const { page } = consignor;
      await openConsignment(page, submissionNeedsChanges);
      await page.getByRole("button", { name: "Send back for review" }).click();
      await expect(page.getByTestId("changes-requested")).toHaveCount(0);
      await consignor.close();
    },
  );
});
