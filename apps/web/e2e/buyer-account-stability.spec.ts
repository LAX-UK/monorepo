import { type BrowserContext, type Page, expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";

/**
 * The account in use never changes by itself: an organisation member keeps their organisation
 * page after page, and a switch made in another tab is announced in this one, never silent.
 * Signed in as the seeded organisation owner (`estate-owner@lax.bid`).
 */

type MenuAccount = { id: string; kind: "personal" | "organisation"; name: string };

const ACTING_COOKIE = "lax_acting_legal_entity_id";

/** Pages every organisation owner can open, visited in turn. */
const WORKSPACE_PAGES = ["/home", "/watching", "/notifications", "/settings", "/organisation"];

async function firstOrganisation(page: Page): Promise<MenuAccount> {
  const res = await page.request.get("/api/me/menu-context");
  expect(res.ok(), `menu context answered ${res.status()}`).toBe(true);
  const body = (await res.json()) as { accounts: MenuAccount[] | null };
  const organisation = body.accounts?.find((account) => account.kind === "organisation");
  if (!organisation) throw new Error("The seeded buyer has no organisation to act for");
  return organisation;
}

/**
 * Chooses the organisation in this browser the way an earlier session would have left it, so the
 * person's remembered account on their profile is not changed for other specs.
 */
async function useOrganisationInThisBrowser(context: BrowserContext, url: string, id: string) {
  await context.addCookies([{ name: ACTING_COOKIE, value: id, url }]);
}

async function expectActingFor(page: Page, organisationName: string) {
  await expect(page.getByTestId("account-switcher")).toContainText(organisationName);
  await expect(page.getByText("We couldn't load your accounts")).toHaveCount(0);
  expect(new URL(page.url()).pathname).not.toMatch(/no-access|restore-account|switch-account/);
}

test.describe("buyer account stability @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("keeps the organisation across 30 page loads in a row", async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const organisation = await firstOrganisation(page);
    await useOrganisationInThisBrowser(
      context,
      baseURL ?? "http://localhost:3000",
      organisation.id,
    );

    for (let visit = 0; visit < 30; visit++) {
      const path = WORKSPACE_PAGES[visit % WORKSPACE_PAGES.length] ?? "/home";
      await page.goto(path);
      await expectActingFor(page, organisation.name);
    }
  });

  test("tells this tab when the account is switched in another one", async ({
    page,
    context,
    baseURL,
  }) => {
    const organisation = await firstOrganisation(page);
    await useOrganisationInThisBrowser(
      context,
      baseURL ?? "http://localhost:3000",
      organisation.id,
    );
    await page.goto("/home");
    await expectActingFor(page, organisation.name);

    const other = await context.newPage();
    await other.goto("/home");
    await expectActingFor(other, organisation.name);
    await other
      .getByRole("button", { name: `Account: ${organisation.name},` })
      .first()
      .click();
    await other.getByTestId("switch-account-personal").click();
    await expect(other.getByTestId("account-switcher")).toHaveCount(0);

    // The first tab follows, and says why, rather than silently acting for the new account.
    await page.bringToFront();
    await expect(page.getByTestId("account-notice")).toContainText(
      "You switched to your personal account in another tab",
    );
    await expect(page.getByTestId("account-switcher")).toHaveCount(0);
    await other.close();
  });
});
