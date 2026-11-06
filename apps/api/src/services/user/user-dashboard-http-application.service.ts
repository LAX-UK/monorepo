import {
  PURCHASE_LIST_LIMIT,
  accountBidScope,
  accountPurchaseScope,
  decisivePaymentByLot,
} from "@auction/domain";
import type { IRecordPeopleReader } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import type { LotReadPort, SaleLookupPort } from "../../container/container-slices.js";
import { lotsWithCheckoutPricing } from "../../lib/lots-with-checkout-pricing.js";
import { presentLotsImages } from "../../lib/media-presenters.js";
import { accountPurchaseLots, personalPurchaseLots } from "../amounts-owed/purchase-lot-queries.js";
import type { IAmountsOwedService } from "../interfaces/amounts-owed.js";
import type { IConditionReportService } from "../interfaces/condition-report.js";
import type { IMediaAssetEnricher } from "../interfaces/media-asset-enricher.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { IPaymentBuyerService } from "../interfaces/payment-service.js";
import type {
  BuyingAccountActor,
  IUserDashboardHttpApplicationService,
} from "../interfaces/user-routes/user-dashboard-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import type { UserDashboardReadService } from "../user-dashboard-read.service.js";

/** A role that does not follow the account's buying records. */
const NOT_YOURS: UserHttpJson = {
  status: 403,
  body: { error: "insufficient_entity_role", code: "insufficient_entity_role" },
};

export type UserDashboardHttpDeps = {
  conditionReportService: IConditionReportService;
  userDashboardReadService: UserDashboardReadService;
  lotService: LotReadPort;
  paymentBuyerService: IPaymentBuyerService;
  mediaUrlResolver: IMediaUrlResolver;
  mediaAssetEnricher: IMediaAssetEnricher;
  saleService: SaleLookupPort;
  /** Names the member who placed each of an account's bids. */
  recordPeople: IRecordPeopleReader;
  amountsOwed: IAmountsOwedService;
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
    const [lots, { data: payments }] = await Promise.all([
      this.deps.lotService.list(personalPurchaseLots(userId, PURCHASE_LIST_LIMIT)),
      this.deps.paymentBuyerService.listMyPaymentsForBuyerApi(userId, {}),
    ]);
    return { status: 200, body: { data: await this.toPurchaseRows(lots, payments) } };
  }

  async listAccountBids(input: {
    userId: string;
    account: BuyingAccountActor;
    saleId?: string;
  }): Promise<UserHttpJson> {
    const scope = accountBidScope(input.account);
    if (!scope) return NOT_YOURS;
    const rows = await this.deps.userDashboardReadService.listBidsForBuyerAccount(
      input.account.legalEntityId,
      scope === "own" ? input.userId : null,
      input.saleId,
    );
    const bidderIds = rows.flatMap((r) => (r.bid.bidderId ? [r.bid.bidderId] : []));
    const names = await this.deps.recordPeople.namesFor(bidderIds);
    const data = rows.map((row) => {
      const userId = row.bid.bidderId;
      return {
        ...row,
        placedBy: userId ? { userId, name: names.get(userId) ?? null } : null,
      };
    });
    return { status: 200, body: { data } };
  }

  async listAccountPurchases(input: {
    userId: string;
    account: BuyingAccountActor;
  }): Promise<UserHttpJson> {
    const scope = accountPurchaseScope(input.account);
    if (!scope) return NOT_YOURS;
    const accountId = input.account.legalEntityId;
    const [lots, { data: payments }] = await Promise.all([
      this.deps.lotService.list(
        accountPurchaseLots(accountId, scope, input.userId, PURCHASE_LIST_LIMIT),
      ),
      this.deps.paymentBuyerService.listEntityPaymentsForBuyerApi(accountId, {}),
    ]);
    return { status: 200, body: { data: await this.toPurchaseRows(lots, payments) } };
  }

  async listAmountsOwed(input: {
    userId: string;
    account: BuyingAccountActor;
  }): Promise<UserHttpJson> {
    const data = await this.deps.amountsOwed.forAccount(input);
    return data ? { status: 200, body: { data } } : NOT_YOURS;
  }

  /** Won lots with images, checkout pricing and the deciding payment for each. */
  private async toPurchaseRows(
    lots: Lot[],
    payments: Awaited<ReturnType<IPaymentBuyerService["listMyPaymentsForBuyerApi"]>>["data"],
  ) {
    const byLot = decisivePaymentByLot(payments);
    const presentedLots = await presentLotsImages(
      this.deps.mediaUrlResolver,
      lots,
      this.deps.mediaAssetEnricher,
    );
    const pricedLots = await lotsWithCheckoutPricing(
      { saleService: this.deps.saleService },
      presentedLots,
    );
    return pricedLots.map((lotRow) => {
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
  }
}
