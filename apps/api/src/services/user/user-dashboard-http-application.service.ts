import type { LotReadPort, SaleLookupPort } from "../../container/container-slices.js";
import { lotsWithCheckoutPricing } from "../../lib/lots-with-checkout-pricing.js";
import { presentLotsImages } from "../../lib/media-presenters.js";
import type { IConditionReportService } from "../interfaces/condition-report.js";
import type { IMediaAssetEnricher } from "../interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { IPaymentBuyerService } from "../interfaces/payment-service.js";
import type { IUserDashboardHttpApplicationService } from "../interfaces/user-routes/user-dashboard-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { UserDashboardReadService } from "../user-dashboard-read.service.js";

export type UserDashboardHttpDeps = {
  conditionReportService: IConditionReportService;
  userDashboardReadService: UserDashboardReadService;
  lotService: LotReadPort;
  paymentBuyerService: IPaymentBuyerService;
  mediaUrlResolver: IMediaUrlResolver;
  mediaAssetEnricher: IMediaAssetEnricher;
  saleService: SaleLookupPort;
};

export class UserDashboardHttpApplicationService implements IUserDashboardHttpApplicationService {
  constructor(private readonly deps: UserDashboardHttpDeps) {}

  async listConditionReportRequests(input: {
    userId: string;
    query: { limit: number; offset: number };
  }): Promise<UserHttpJson> {
    const { items, total } = await this.deps.conditionReportService.listForBuyer({
      userId: input.userId,
      limit: input.query.limit,
      offset: input.query.offset,
    });
    return {
      status: 200,
      body: { data: { items, total, limit: input.query.limit, offset: input.query.offset } },
    };
  }

  async listBids(input: { userId: string }): Promise<UserHttpJson> {
    const data = await this.deps.userDashboardReadService.listBidsForUser(input.userId);
    return { status: 200, body: { data } };
  }

  async listPortfolio(input: { userId: string }): Promise<UserHttpJson> {
    const userId = input.userId;
    const lots = await this.deps.lotService.list({
      winnerId: userId,
      limit: 50,
      offset: 0,
    });
    const { data: payments } = await this.deps.paymentBuyerService.listMyPaymentsForBuyerApi(
      userId,
      {},
    );
    const byLot = new Map<string, (typeof payments)[number]>();
    for (const p of payments) {
      if (!byLot.has(p.lotId)) byLot.set(p.lotId, p);
    }
    const presentedLots = await presentLotsImages(
      this.deps.mediaUrlResolver,
      lots,
      this.deps.mediaAssetEnricher,
    );
    const pricedLots = await lotsWithCheckoutPricing(
      { saleService: this.deps.saleService },
      presentedLots,
    );
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
    return { status: 200, body: { data } };
  }
}
