import {
  accountBidsQuerySchema,
  listMyConditionReportRequestsQuerySchema,
} from "@auction/validators";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { LegalEntityContext } from "../../middleware/require-legal-entity-context.js";
import type { BuyingAccountActor } from "../../services/interfaces/user-routes/user-dashboard-http.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserDashboardRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth } = deps;

  r.get(
    "/me/condition-report-requests",
    requireAuth,
    zValidator("query", listMyConditionReportRequestsQuerySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const query = c.req.valid("query");
      const response = await container.userRoutes.dashboardHttp.listConditionReportRequests({
        userId,
        query,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.get("/me/bids", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.dashboardHttp.listBids({ userId });
    return respondUserHttpJson(c, response);
  });

  r.get("/me/portfolio", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.dashboardHttp.listPortfolio({ userId });
    return respondUserHttpJson(c, response);
  });

  /**
   * The acting account's buying records (`X-Legal-Entity-Id`): what the member's role follows of
   * the bids placed and the lots won for it. The personal reads above stay the person's own.
   */
  const requireBuyingAccount = container.userRoutes.requireBuyingAccount;

  r.get(
    "/me/account/bids",
    requireAuth,
    requireBuyingAccount,
    zValidator("query", accountBidsQuerySchema),
    async (c) => {
      const account = buyingAccountOf(c.get("legalEntityContext"));
      if (!account) return c.json({ error: "insufficient_entity_role" }, 403);
      const userId = c.get("userId") as string;
      const { saleId } = c.req.valid("query");
      const response = await container.userRoutes.dashboardHttp.listAccountBids({
        userId,
        account,
        ...(saleId ? { saleId } : {}),
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.get("/me/account/purchases", requireAuth, requireBuyingAccount, async (c) => {
    const account = buyingAccountOf(c.get("legalEntityContext"));
    if (!account) return c.json({ error: "insufficient_entity_role" }, 403);
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.dashboardHttp.listAccountPurchases({
      userId,
      account,
    });
    return respondUserHttpJson(c, response);
  });
}

function buyingAccountOf(ctx: LegalEntityContext | undefined): BuyingAccountActor | null {
  if (!ctx) return null;
  return {
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}
