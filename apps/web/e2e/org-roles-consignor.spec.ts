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
 */

const { approved } = ORGANISATION_JOURNEY_NAMES;
const { submissionDraft, submissionNeedsChanges } = ORGANISATION_JOURNEY_IDS;

async function openConsignment(page: Page, id: string) {
  await page.goto(`/selling/consignments/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("organisation consignor journey @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);
  // Sending changes the work's state, so a retry would start from a changed work.
  test.describe.configure({ retries: 0 });

  test("submits a work, answers a request for changes and cannot open the team", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const consignor = await openAs(browser, roleAuthState.orgConsignor, approved, baseURL);
    const { page } = consignor;

    await test.step("acts as a consignor", async () => {
      await page.goto("/home");
      await expectActingAs(page, approved, "Consignor");
    });

    await test.step("sends a complete draft to the specialist", async () => {
      await openConsignment(page, submissionDraft);
      const send = page.getByRole("button", { name: "Submit for specialist review" }).first();
      await expect(send).toBeVisible();
      await send.click();
      await expect(page.getByText("Submitted for review").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Submit for specialist review" })).toHaveCount(
        0,
      );
    });

    await test.step("answers a request for changes", async () => {
      await openConsignment(page, submissionNeedsChanges);
      await expect(page.getByTestId("changes-requested")).toContainText(
        "Please add a clearer photograph of the signature.",
      );
      await page.getByRole("button", { name: "Send back for review" }).first().click();
      await expect(page.getByTestId("changes-requested")).toHaveCount(0);
    });

    await test.step("has no Members tab and the address gives the access page", async () => {
      await expectNoAccess(page, "/team");
      await expectNoAccess(page, "/purchases");
    });

    await consignor.close();
  });
});
