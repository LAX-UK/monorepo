import { respondUserHttpJson } from "../../lib/user-route-response.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

/**
 * The signed-in person's holdings and money across Bid, in the shared LAX portfolio shape.
 * Read-only and limited to their personal entity; organisations stay inside Bid.
 */
export function attachUserLaxPortfolioRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requirePortfolioRead } = deps;

  r.get("/me/lax-portfolio", requirePortfolioRead, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.laxPortfolioHttp.getPortfolio({ userId });
    c.header("Cache-Control", "private, no-store");
    return respondUserHttpJson(c, response);
  });

  r.get("/me/lax-money", requirePortfolioRead, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.laxPortfolioHttp.getMoney({ userId });
    c.header("Cache-Control", "private, no-store");
    return respondUserHttpJson(c, response);
  });
}
