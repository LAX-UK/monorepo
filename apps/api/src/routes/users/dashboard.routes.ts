import { listMyConditionReportRequestsQuerySchema } from "@auction/validators";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
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
}
