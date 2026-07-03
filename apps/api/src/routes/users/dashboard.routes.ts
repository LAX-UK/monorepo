import { listMyConditionReportRequestsQuerySchema } from "@auction/validators";
import { lotsWithCheckoutPricing } from "../../lib/lots-with-checkout-pricing.js";
import { presentLotsImages } from "../../lib/media-presenters.js";
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
      const { limit, offset } = c.req.valid("query");
      const { items, total } = await container.conditionReportService.listForBuyer({
        userId,
        limit,
        offset,
      });
      return c.json({ data: { items, total, limit, offset } });
    },
  );

  r.get("/me/bids", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.userDashboardReadService.listBidsForUser(userId);
    return c.json({ data });
  });

  r.get("/me/portfolio", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const lots = await container.lotService.list({
      winnerId: userId,
      limit: 50,
      offset: 0,
    });
    // Use the full buyer payments presenter so manualReviewReason is derived
    // (AML/SoF compliance check included) — avoids a separate N+1 gate call.
    const { data: payments } = await container.paymentBuyerService.listMyPaymentsForBuyerApi(
      userId,
      {},
    );
    const byLot = new Map<string, (typeof payments)[number]>();
    for (const p of payments) {
      if (!byLot.has(p.lotId)) byLot.set(p.lotId, p);
    }
    const presentedLots = await presentLotsImages(
      container.mediaUrlResolver,
      lots,
      container.mediaAssetEnricher,
    );
    const pricedLots = await lotsWithCheckoutPricing(container, presentedLots);
    const data = pricedLots.map((lotRow) => {
      const p = byLot.get(lotRow.id);
      return {
        lot: lotRow,
        payment: p
          ? {
              id: p.id,
              status: p.status,
              manualReviewReason: p.manualReviewReason ?? null,
              createdAt: p.createdAt,
            }
          : null,
      };
    });
    return c.json({ data });
  });
}
