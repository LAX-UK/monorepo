import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_IDS,
  ORGANISATION_JOURNEY_NAMES,
  expectActingAs,
  invitationLinkFor,
  openAs,
  placeBid,
  switchOrganisation,
  undoOf,
} from "./helpers/organisation-journeys";

/**
 * An owner of Northbank Gallery runs the organisation: invites someone who accepts from their own
 * browser, switches organisation and back, bids, chooses for a work that did not sell, changes a
 * role and takes the change back, then removes the member again. Owners need no sale registration
 * to bid, so the bid is placed straight away.
 */

const INVITEE_EMAIL = "apple-test@lax.bid";
const INVITEE_NAME = "Apple Test";
const { approved, other } = ORGANISATION_JOURNEY_NAMES;

test.describe("organisation owner journey @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);
  // The journey changes the team, so a retry would start from a changed team.
  test.describe.configure({ retries: 0 });

  test("invites, bids, chooses, changes a role with Undo and removes a member", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    const owner = await openAs(browser, roleAuthState.buyer, approved, baseURL);
    const { page } = owner;

    await test.step("invite someone as a viewer", async () => {
      await page.goto("/team");
      await expectActingAs(page, approved, "Owner");
      await expect(page.getByRole("heading", { level: 1, name: "Team" })).toBeVisible();

      await page.getByRole("button", { name: "Invite members" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Email addresses").fill(INVITEE_EMAIL);
      await dialog.getByLabel("Email addresses").press("Enter");
      await dialog.getByRole("radio", { name: "Viewer" }).click();
      await dialog.getByRole("button", { name: "Send invitation" }).click();
      await expect(page.getByText(`Invitation sent to join ${approved}`)).toBeVisible();
    });

    await test.step("the invitee accepts from their own browser", async () => {
      const link = await invitationLinkFor(INVITEE_EMAIL);
      const invitee = await browser.newContext({
        storageState: roleAuthState.zeroLot,
        baseURL: owner.origin,
      });
      const invitation = await invitee.newPage();
      await invitation.goto(link);
      await expect(invitation.getByRole("heading", { name: `Join ${approved}` })).toBeVisible();
      await invitation.getByTestId("invitation-accept").click();
      await expect(invitation.getByTestId("invitation-accept")).toHaveCount(0);
      await invitee.close();

      await page.reload();
      await expect(page.getByText(INVITEE_NAME).first()).toBeVisible();
    });

    await test.step("switch organisation and back", async () => {
      await switchOrganisation(page, approved, other);
      await page.waitForLoadState("networkidle");
      await switchOrganisation(page, other, approved);
    });

    await test.step("bid for the organisation", async () => {
      const bid = await placeBid(owner, ORGANISATION_JOURNEY_IDS.lotForOwner, 2500);
      expect(bid.status, `bid answered ${bid.status} ${bid.error}`).toBeLessThan(300);
      await page.goto("/bids");
      await expect(page.getByText("Harbour Light, study for the owner").first()).toBeVisible();
    });

    await test.step("choose what happens to a work that did not sell", async () => {
      await page.goto(`/selling/consignments/${ORGANISATION_JOURNEY_IDS.submissionUnsold}`);
      await expect(page.getByRole("heading", { name: "Choose what happens next" })).toBeVisible();
      await page.getByRole("radio", { name: /Sell it privately/ }).check();
      await page.getByRole("button", { name: "Send to your specialist" }).click();
      await expect(page.getByText("Sent to your specialist").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Send to your specialist" })).toHaveCount(0);
    });

    await test.step("change a role and take it back", async () => {
      await page.goto("/team");
      const picker = page.getByRole("button", { name: new RegExp(`^Role for ${INVITEE_NAME}`) });
      await expect(picker).toContainText("Viewer");
      await picker.click();
      await page.getByRole("menuitemradio", { name: "Finance" }).click();
      await expect(page.getByText(`${INVITEE_NAME} is now`)).toBeVisible();
      await undoOf(page, `${INVITEE_NAME} is now`).click();
      await expect(picker).toContainText("Viewer");
    });

    await test.step("owners can hand over ownership", async () => {
      await page.getByRole("button", { name: "More for Maya Okafor" }).click();
      await expect(page.getByRole("menuitem", { name: /^Transfer ownership/ })).toBeVisible();
      await page.keyboard.press("Escape");
    });

    await test.step("remove the member", async () => {
      await page.getByRole("button", { name: `More for ${INVITEE_NAME}` }).click();
      await page.getByRole("menuitem", { name: /^Remove from/ }).click();
      await page.getByRole("button", { name: "Remove member" }).click();
      await expect(
        page.getByText(`${INVITEE_NAME} has been removed from ${approved}.`),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: `More for ${INVITEE_NAME}` })).toHaveCount(0);
    });

    await owner.close();
  });
});
