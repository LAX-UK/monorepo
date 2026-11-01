import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  BUYER_AGENT_BID_LIMIT,
  ORGANISATION_JOURNEY_IDS,
  ORGANISATION_JOURNEY_NAMES,
  expectActingAs,
  expectNoAccess,
  openAs,
  placeBid,
} from "./helpers/organisation-journeys";
import { expectWorkspaceBaselines } from "./helpers/workspace-baselines";

/**
 * A buyer agent bids for Northbank Gallery through an authorisation with a limit: a bid inside it
 * is placed, a bid above it is refused with the message the bid dialog shows. Buyer agents see
 * their own bids but not the team.
 */

const { approved } = ORGANISATION_JOURNEY_NAMES;

test.describe("organisation buyer agent journey @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("bids within the authorised limit and is refused above it", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const agent = await openAs(browser, roleAuthState.orgBuyerAgent, approved, baseURL);
    const { page } = agent;
    const lot = ORGANISATION_JOURNEY_IDS.lotForBuyerAgent;

    await test.step("acts as a buyer agent", async () => {
      await page.goto("/home");
      await expectActingAs(page, approved, "Buyer agent");
    });

    await test.step("a bid within the limit is placed", async () => {
      const bid = await placeBid(agent, lot, 5300);
      expect(bid.status, `bid answered ${bid.status} ${bid.error}`).toBe(201);
      // It is on the agent's own list too.
      await page.goto("/bids");
      await expect(
        page.getByText("Harbour Light, study for the buyer agent").first(),
      ).toBeVisible();
    });

    await test.step("a bid over the limit is refused with its message", async () => {
      const bid = await placeBid(agent, lot, BUYER_AGENT_BID_LIMIT + 500);
      expect(bid.status).toBe(403);
      expect(bid.code).toBe("over_limit");
      expect(bid.error).toBe(
        "This bid exceeds your buyer agent authorisation limit for this sale.",
      );
    });

    await test.step("sees nothing of the team", async () => {
      await expectNoAccess(page, "/team");
    });

    await agent.close();
  });
});

test.describe("organisation buyer agent baselines @a11y", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("every workspace page passes axe in light and dark at 1440 and 375", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    await expectWorkspaceBaselines(browser, roleAuthState.orgBuyerAgent, approved, baseURL);
  });
});
