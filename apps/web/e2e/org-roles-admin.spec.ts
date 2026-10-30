import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_NAMES,
  expectActingAs,
  openAs,
  undoOf,
} from "./helpers/organisation-journeys";

/**
 * An admin of Northbank Gallery runs the team like an owner, except that an admin only reads the
 * two-step policy and cannot hand over ownership. The journey invites and withdraws an
 * invitation (with Undo) and changes a role and takes it back, leaving the team as it found it.
 */

const INVITEE_EMAIL = "admin-journey-invitee@example.com";
const MEMBER_NAME = "Sofia Petrov";
const { approved } = ORGANISATION_JOURNEY_NAMES;

test.describe("organisation admin journey @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);
  // The journey changes the team, so a retry would start from a changed team.
  test.describe.configure({ retries: 0 });

  test("manages the team without ownership or policy rights", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const admin = await openAs(browser, roleAuthState.orgAdmin, approved, baseURL);
    const { page } = admin;

    await test.step("opens Team and the Organisation page from the menu", async () => {
      await page.goto("/team");
      await expectActingAs(page, approved, "Admin");
      await expect(page.getByRole("heading", { level: 1, name: "Team" })).toBeVisible();
      const menu = page.getByRole("navigation", { name: "Bid" });
      await expect(menu.getByRole("link", { name: "Team", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(menu.getByRole("link", { name: "Organisation", exact: true })).toBeVisible();
    });

    await test.step("invites someone and withdraws the invitation with Undo", async () => {
      await page.getByLabel("Email").fill(INVITEE_EMAIL);
      await page.getByRole("combobox", { name: "Role", exact: true }).click();
      await page.getByRole("option", { name: "Viewer" }).click();
      await page.getByRole("button", { name: "Send invitation" }).click();
      await expect(page.getByText(`Invitation sent to ${INVITEE_EMAIL}.`)).toBeVisible();

      await page
        .getByRole("button", { name: `More for the invitation to ${INVITEE_EMAIL}` })
        .click();
      await page.getByRole("menuitem", { name: "Withdraw" }).click();
      await expect(page.getByText(`Invitation to ${INVITEE_EMAIL} withdrawn.`)).toBeVisible();
      await undoOf(page, `Invitation to ${INVITEE_EMAIL} withdrawn.`).click();
      await expect(page.getByText(`Invitation to ${INVITEE_EMAIL} reopened.`)).toBeVisible();

      await page
        .getByRole("button", { name: `More for the invitation to ${INVITEE_EMAIL}` })
        .click();
      await page.getByRole("menuitem", { name: "Withdraw" }).click();
      await expect(page.getByText(`Invitation to ${INVITEE_EMAIL} withdrawn.`)).toBeVisible();
    });

    await test.step("changes a role and takes it back", async () => {
      const picker = page.getByRole("combobox", { name: `Role for ${MEMBER_NAME}` });
      await expect(picker).toContainText("Viewer");
      await picker.click();
      await page.getByRole("option", { name: "Consignor" }).click();
      await expect(page.getByText(`${MEMBER_NAME} is now`)).toBeVisible();
      await undoOf(page, `${MEMBER_NAME} is now`).click();
      await expect(picker).toContainText("Viewer");
    });

    await test.step("cannot hand over ownership", async () => {
      await page.getByRole("button", { name: `More for ${MEMBER_NAME}` }).click();
      await expect(page.getByRole("menuitem", { name: "Remove" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "Transfer ownership" })).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    await test.step("reads the two-step policy", async () => {
      await page.goto("/organisation/security");
      await expect(page.getByRole("heading", { name: "Two-step policy" })).toBeVisible();
    });

    await admin.close();
  });
});
