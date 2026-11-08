import {
  type AccountHold,
  type AmountOwedEntry,
  type HoldHolder,
  PURCHASE_LIST_LIMIT,
  accountPurchaseScope,
  amountOwedEntry,
  decisivePaymentByLot,
  purchasePaymentRole,
} from "@auction/domain";
import type { Lot } from "@auction/types";
import type { LotReadPort, SaleLookupPort } from "../../container/container-slices.js";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { lotsWithCheckoutPricing } from "../../lib/lots-with-checkout-pricing.js";
import {
  type ISettlementComplianceAssessor,
  assessSettlementSubjects,
} from "../aml/settlement-compliance.policy.js";
import type {
  AmountsOwedAccount,
  AmountsOwedView,
  IAmountsOwedService,
} from "../interfaces/amounts-owed.js";
import type { IPaymentBuyerService } from "../interfaces/payment-service.js";
import type { IPaymentEligibilityGate } from "../payment/payment-eligibility.gate.js";
import { accountPurchaseLots, personalPurchaseLots } from "./purchase-lot-queries.js";

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
  /**
   * What holds an organisation's purchases: the account rule and the compliance checks the Pay
   * page plan applies, so Purchases and the Pay page can only ever agree about a hold.
   */
  organisationChecks: {
    eligibility: IPaymentEligibilityGate;
    compliance: ISettlementComplianceAssessor | null;
  };
};

/** What holds the lots of an account: the check, and whose it is. */
type Hold = { hold: AccountHold; holder: HoldHolder | null };
const NO_HOLD: Hold = { hold: "clear", holder: null };

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
        accountPurchaseLots(account.legalEntityId, scope, userId, PURCHASE_LIST_LIMIT),
      ),
      this.deps.paymentBuyerService
        .listEntityPaymentsForBuyerApi(account.legalEntityId, {})
        .then((result) => result.data),
    ]);
    return this.view(
      userId,
      lots,
      payments,
      (lot) =>
        purchasePaymentRole({
          payerUserId: userId,
          lot: { winnerId: lot.winnerId ?? null, buyerAccountKind: "organisation" },
          membership: account,
        }),
      (owed) => this.organisationHold(userId, account.legalEntityId, owed),
    );
  }

  private async personal(userId: string, personalId: string): Promise<AmountsOwedView> {
    const [lots, payments] = await Promise.all([
      this.deps.lotService.list(personalPurchaseLots(userId, PURCHASE_LIST_LIMIT)),
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
    /** What holds an organisation's purchases; a person's own account uses their own gate. */
    holdOf?: (owed: readonly OwedLot[]) => Promise<Hold>,
  ): Promise<AmountsOwedView> {
    const [priced, fulfilments] = await Promise.all([
      lotsWithCheckoutPricing({ saleService: this.deps.saleService }, lots),
      this.deps.fulfilments.statusesForLots(lots.map((lot) => lot.id)),
    ]);
    const paymentByLot = decisivePaymentByLot(payments);
    const build = ({ hold, holder }: Hold) =>
      this.entries(priced, paymentByLot, fulfilments, roleOf, hold, holder);
    if (!holdOf) {
      const gate = await this.deps.paymentBuyerService.getBuyerComplianceGateStatus(userId);
      return {
        entries: build({ hold: gate.status, holder: gate.status === "clear" ? null : "payer" }),
      };
    }
    // What the account owes decides what the checks are about, so it is worked out first.
    const open = build(NO_HOLD);
    const owed = open.flatMap((entry) => {
      const lot = priced.find((l) => l.id === entry.lotId);
      return lot && entry.role !== "none" && entry.state === "payment-due"
        ? [
            {
              lotId: entry.lotId,
              winnerId: lot.winnerId ?? null,
              role: entry.role,
              amountDue: entry.amountDue,
              paymentId: paymentByLot.get(entry.lotId)?.id ?? null,
            },
          ]
        : [];
    });
    return { entries: build(owed.length > 0 ? await holdOf(owed) : NO_HOLD) };
  }

  private entries(
    priced: Awaited<ReturnType<typeof lotsWithCheckoutPricing>>,
    paymentByLot: ReadonlyMap<string, PaymentRow>,
    fulfilments: Map<string, string>,
    roleOf: (lot: Lot) => AmountOwedEntry["role"],
    hold: AccountHold,
    holder: HoldHolder | null,
  ): AmountOwedEntry[] {
    return priced.flatMap((lot) => {
      const payment = paymentByLot.get(lot.id);
      const entry = amountOwedEntry(
        {
          lotId: lot.id,
          paymentStatus: payment?.status ?? null,
          fulfilmentStatus: fulfilments.get(lot.id) ?? null,
          paymentReviewReason: payment?.manualReviewReason ?? null,
          role: roleOf(lot as Lot),
          // The invoice total once raised (it never changes); the lot priced now only before that.
          amountDue: payment?.amount ?? lot.checkoutPricing?.totalMajor ?? null,
          currency: PLATFORM_CURRENCY,
        },
        hold,
        holder,
      );
      return entry ? [entry] : [];
    });
  }

  /**
   * What holds an organisation's purchases, by the Pay page plan's own rules: LAX still checking
   * the organisation, then the compliance checks on the person paying (for what they pay) and on
   * each lot's winner (for what they won).
   */
  private async organisationHold(
    userId: string,
    legalEntityId: string,
    owed: readonly OwedLot[],
  ): Promise<Hold> {
    const { eligibility, compliance } = this.deps.organisationChecks;
    const account = await eligibility.check({
      payerUserId: userId,
      buyerLegalEntityId: legalEntityId,
    });
    if (account.kind !== "payable")
      return { hold: "organisation_under_review", holder: "organisation" };
    if (!compliance) return NO_HOLD;
    const payerOwes = owed.filter((lot) => lot.role === "payer");
    if (payerOwes.length === 0) return NO_HOLD;
    const pence = (lot: OwedLot) => gbpAmountToPence(lot.amountDue ?? "0");
    const decision = await assessSettlementSubjects(
      compliance,
      [
        { buyerUserId: userId, amountPence: payerOwes.reduce((sum, lot) => sum + pence(lot), 0) },
        ...payerOwes.flatMap((lot) =>
          lot.winnerId && lot.winnerId !== userId
            ? [{ buyerUserId: lot.winnerId, amountPence: pence(lot) }]
            : [],
        ),
      ],
      payerOwes.flatMap((lot) => (lot.paymentId ? [lot.paymentId] : [])),
    );
    if (!decision.hold || !decision.reason) return NO_HOLD;
    return { hold: decision.reason, holder: decision.subject === userId ? "payer" : "winner" };
  }
}

/** A lot that is owed and can be paid, as the organisation checks need to see it. */
type OwedLot = {
  lotId: string;
  winnerId: string | null;
  role: AmountOwedEntry["role"];
  amountDue: string | null;
  paymentId: string | null;
};
