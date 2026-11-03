import {
  type AccountHold,
  type AmountOwedEntry,
  accountPurchaseScope,
  amountOwedEntry,
  purchasePaymentRole,
} from "@auction/domain";
import type { Lot } from "@auction/types";
import type { LotReadPort, SaleLookupPort } from "../../container/container-slices.js";
import { lotsWithCheckoutPricing } from "../../lib/lots-with-checkout-pricing.js";
import type {
  AmountsOwedAccount,
  AmountsOwedView,
  IAmountsOwedService,
} from "../interfaces/amounts-owed.js";
import type { IPaymentBuyerService } from "../interfaces/payment-service.js";
import { accountPurchaseLots, personalPurchaseLots } from "./purchase-lot-queries.js";

/** The most won lots one read follows; a longer history is settled long before it matters here. */
const AMOUNTS_OWED_LOT_LIMIT = 500;
const PLATFORM_CURRENCY = "GBP";

type PaymentRow = Awaited<
  ReturnType<IPaymentBuyerService["listMyPaymentsForBuyerApi"]>
>["data"][number];

export type AmountsOwedDeps = {
  lotService: LotReadPort;
  saleService: SaleLookupPort;
  paymentBuyerService: Pick<
    IPaymentBuyerService,
    "listMyPaymentsForBuyerApi" | "listEntityPaymentsForBuyerApi" | "getBuyerComplianceGateStatus"
  >;
  fulfilments: { statusesForLots(lotIds: readonly string[]): Promise<Map<string, string>> };
  /** The id of the person's own account, to tell it from an organisation's. */
  personalAccount: { idFor(userId: string): Promise<string> };
};

/**
 * What an account owes, worked out once for every screen that says so. The lots and payments are
 * the ones Purchases lists; the domain decides each lot's state and what blocks it.
 */
export class AmountsOwedService implements IAmountsOwedService {
  constructor(private readonly deps: AmountsOwedDeps) {}

  async forPerson(userId: string): Promise<AmountsOwedView> {
    const personalId = await this.deps.personalAccount.idFor(userId);
    return this.personal(userId, personalId);
  }

  async forAccount(input: {
    userId: string;
    account: AmountsOwedAccount;
  }): Promise<AmountsOwedView | null> {
    const { userId, account } = input;
    const personalId = await this.deps.personalAccount.idFor(userId);
    if (account.legalEntityId === personalId) return this.personal(userId, personalId);

    const scope = accountPurchaseScope(account);
    if (!scope) return null;
    const [lots, payments] = await Promise.all([
      this.deps.lotService.list(
        accountPurchaseLots(account.legalEntityId, scope, userId, AMOUNTS_OWED_LOT_LIMIT),
      ),
      this.deps.paymentBuyerService
        .listEntityPaymentsForBuyerApi(account.legalEntityId, {})
        .then((result) => result.data),
    ]);
    return this.view(userId, lots, payments, (lot) =>
      purchasePaymentRole({
        payerUserId: userId,
        lot: { winnerId: lot.winnerId ?? null, buyerAccountKind: "organisation" },
        membership: account,
      }),
    );
  }

  private async personal(userId: string, personalId: string): Promise<AmountsOwedView> {
    const [lots, payments] = await Promise.all([
      this.deps.lotService.list(personalPurchaseLots(userId, AMOUNTS_OWED_LOT_LIMIT)),
      this.deps.paymentBuyerService
        .listMyPaymentsForBuyerApi(userId, {})
        .then((result) => result.data),
    ]);
    // A lot the person won for an organisation is paid by that organisation: they are told, not asked.
    return this.view(userId, lots, payments, (lot) => {
      const forAnotherAccount = Boolean(
        lot.buyerLegalEntityId && lot.buyerLegalEntityId !== personalId,
      );
      if (forAnotherAccount) return lot.winnerId === userId ? "informed" : "none";
      return purchasePaymentRole({
        payerUserId: userId,
        lot: { winnerId: lot.winnerId ?? null, buyerAccountKind: "individual" },
        membership: null,
      });
    });
  }

  private async view(
    userId: string,
    lots: Lot[],
    payments: PaymentRow[],
    roleOf: (lot: Lot) => AmountOwedEntry["role"],
  ): Promise<AmountsOwedView> {
    const [priced, fulfilments, gate] = await Promise.all([
      lotsWithCheckoutPricing({ saleService: this.deps.saleService }, lots),
      this.deps.fulfilments.statusesForLots(lots.map((lot) => lot.id)),
      this.deps.paymentBuyerService.getBuyerComplianceGateStatus(userId),
    ]);
    const paymentByLot = new Map<string, PaymentRow>();
    for (const payment of payments) {
      if (!paymentByLot.has(payment.lotId)) paymentByLot.set(payment.lotId, payment);
    }
    const hold: AccountHold = gate.status;
    const entries = priced.flatMap((lot) => {
      const payment = paymentByLot.get(lot.id);
      const entry = amountOwedEntry(
        {
          lotId: lot.id,
          paymentStatus: payment?.status ?? null,
          fulfilmentStatus: fulfilments.get(lot.id) ?? null,
          paymentReviewReason: payment?.manualReviewReason ?? null,
          role: roleOf(lot as Lot),
          // The total with the buyer's premium: what Purchases shows and one payment covers.
          amountDue: lot.checkoutPricing?.totalMajor ?? payment?.amount ?? null,
          currency: PLATFORM_CURRENCY,
        },
        hold,
      );
      return entry ? [entry] : [];
    });
    return { entries };
  }
}
