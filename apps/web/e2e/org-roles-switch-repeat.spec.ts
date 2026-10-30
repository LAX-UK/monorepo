import { expect, test } from "@playwright/test";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_NAMES,
  openAs,
  switchOrganisation,
} from "./helpers/organisation-journeys";

const { approved, other } = ORGANISATION_JOURNEY_NAMES;

/**
 * Switching accounts back and forth on Home, many times: each switch shows the new account at
 * once, without a reload. The switch used to leave the old account showing, now and then, when it
 * was made from the page it opens.
 */
test.describe("organisation account switch repeats @roles", () => {
  test("every switch on Home shows the new account", async ({ browser, baseURL }) => {
    test.setTimeout(170_000);
    const owner = await openAs(browser, roleAuthState.buyer, approved, baseURL);
    await owner.page.goto("/home");
    for (let round = 0; round < 8; round++) {
      await switchOrganisation(owner.page, approved, other);
      await switchOrganisation(owner.page, other, approved);
    }
    await expect(owner.page.getByTestId("account-switcher")).toContainText(approved);
    await owner.close();
  });
});
