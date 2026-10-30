import { test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_NAMES,
  expectAccess,
  expectActingAs,
  expectNoAccess,
  openAs,
} from "./helpers/organisation-journeys";

/**
 * A viewer at Northbank Gallery reads what the organisation shows them and nothing else: every
 * address that belongs to another role gives the access page.
 */

const { approved } = ORGANISATION_JOURNEY_NAMES;

const READABLE = ["/home", "/selling/consignments", "/notifications"];
const FORBIDDEN = [
  "/bids",
  "/purchases",
  "/organisation",
  "/team",
  "/organisation/documents",
  "/organisation/payouts",
  "/organisation/security",
  // Payouts settle the whole organisation's sales; the page names who can open it.
  "/selling/payouts",
];

test.describe("organisation viewer journey @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("reads only, and every forbidden address gives the access page", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const viewer = await openAs(browser, roleAuthState.orgViewer, approved, baseURL);
    const { page } = viewer;

    await test.step("acts as a viewer", async () => {
      await page.goto("/home");
      await expectActingAs(page, approved, "Viewer");
    });

    for (const path of READABLE) {
      await test.step(`opens ${path}`, async () => {
        await expectAccess(page, path);
      });
    }

    for (const path of FORBIDDEN) {
      await test.step(`${path} gives the access page`, async () => {
        await expectNoAccess(page, path);
      });
    }

    await viewer.close();
  });
});
