import type {
  CheckoutRailKind,
  ChosenPaymentMethod,
  CollectionBookingOffer,
  DeliveryQuoteAction,
  PaySeveralSkipReason,
  PayTogetherDecision,
  PurchaseDeliveryStage,
  PurchaseInvoiceStatus,
  PurchasePaymentRole,
  PurchaseProblemCategory,
  PurchaseProblemStatus,
} from "@auction/domain";
import type {
  AccountRegistrationRow,
  DeliveryQuoteRow,
  RecordPerson,
} from "@auction/persistence/interfaces";
import type { BankTransferInstructions, PayPlan, PayPlanProgress } from "@auction/types";
import type { Result } from "neverthrow";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

export type OrganisationBuyingErrorCode =
  | "insufficient_entity_role"
  | "purchase_not_found"
  | "quote_step_not_allowed"
  | "quote_wrong_actor"
  | "quote_changed"
  | "problem_purchase_not_paid"
  | "pay_several_empty"
  | "pay_several_too_many"
  | "pay_several_duplicate"
  | "pay_several_nothing_payable"
  | "pay_several_mixed_currency"
  | "pay_several_payer_on_hold"
  | "pay_several_winner_on_hold"
  | "organisation_closed"
  | "organisation_under_review"
  | "identity_verification_required"
  | "pay_several_below_minimum"
  | "pay_several_over_limit"
  | "pay_several_needs_finance_review"
  | "pay_several_card_over_limit"
  | "payment_in_progress_elsewhere"
  | "pay_several_conflict"
  | "pay_several_unavailable"
  | "pay_plan_unavailable"
  | "onboarding_required"
  | "pay_plan_changed"
  /** The invoice of this lot cannot be shown: none is raised, it was voided, or it is not the member's to see. */
  | "invoice_not_ready";

export type OrganisationBuyingError = {
  code: OrganisationBuyingErrorCode;
  status: 400 | 403 | 404 | 409 | 503;
  message: string;
  /** The plan as it now stands, sent with `pay_plan_changed` so the screen can show it again. */
  quote?: PaySeveralQuote;
};

export type BuyingResult<T> = Promise<Result<T, OrganisationBuyingError>>;

/** The sales the acting account is registered for (the Bids "Sales" view). */
export interface IAccountRegistrationsService {
  list(actor: OrganisationMemberActor): BuyingResult<AccountRegistrationRow[]>;
}

/** A courier quote as a purchase row shows it, with the steps open to this member. */
export type PurchaseQuoteView = Omit<DeliveryQuoteRow, "lotId" | "buyerLegalEntityId"> & {
  actions: DeliveryQuoteAction[];
};

/** One row of the Purchases list. */
export type AccountPurchaseView = {
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  sale: { id: string; title: string | null } | null;
  hammerPrice: string;
  wonBy: RecordPerson | null;
  wonAt: Date;
  /** How the member stands to paying it: the payer, the winner who is told, or neither. */
  paymentRole: PurchasePaymentRole;
  invoice: {
    status: PurchaseInvoiceStatus;
    dueAt: Date | null;
    paymentId: string | null;
    /** The invoice total; `null` until an invoice is raised. */
    totalDue: string | null;
    /**
     * What a part-funded bank transfer still has to send for this invoice, in whole pence; `null`
     * when the invoice is not inside one. Its share of the group's whole remainder.
     */
    stillToSendPence: number | null;
  };
  delivery: {
    stage: PurchaseDeliveryStage;
    method: "collection" | "shipping" | null;
    carrier: string | null;
    trackingNumber: string | null;
    collectedBy: string | null;
    collectedAt: Date | null;
    quote: PurchaseQuoteView | null;
  };
};

export type PurchasesPage = { items: AccountPurchaseView[]; nextOffset: number | null };

export interface IAccountPurchasesService {
  list(
    actor: OrganisationMemberActor,
    page: { limit: number; offset: number },
  ): BuyingResult<PurchasesPage>;
  /** The member's purchases as a CSV document for reconciling. */
  exportCsv(actor: OrganisationMemberActor): BuyingResult<string>;
}

/**
 * Which picked invoices one payment settles, with the total and whether (and how) that total can
 * be paid at once. It is the pay plan, told in the combined-payment screen's terms.
 */
export type PaySeveralQuote = {
  /** The lots that will be paid together, in the order picked. */
  payable: { lotId: string; totalDue: string }[];
  skipped: { lotId: string; reason: PaySeveralSkipReason }[];
  currency: string;
  /** Accepted courier quotes charged with the invoices, in pounds as decimal strings. */
  delivery: { lotId: string; amount: string }[];
  /** The sum of the payable lots and the delivery charged with them, as a decimal string. */
  total: string;
  payTogether: PayTogetherDecision;
};

/** What the person asked to pay: the picked lots and the plan they were shown for them. */
export type PaySeveralRequest = {
  lotIds: readonly string[];
  /** The shown total, in whole pence. Absent from a page that predates the check. */
  expectedTotalPence?: number | undefined;
  /** The lots the shown plan said would be paid. */
  expectedLotIds?: readonly string[] | undefined;
  /** How the payer chose to pay. Absent from a page that predates the choice: the amount decides. */
  method?: ChosenPaymentMethod | undefined;
};

/** The combined payment opened for the payer: where to pay, and what it covers. */
export type PaySeveralStarted = {
  paymentGroupId: string;
  checkoutUrl: string;
  rail: CheckoutRailKind;
  total: string;
  currency: string;
  payable: { lotId: string; amount: string }[];
  delivery: PaySeveralQuote["delivery"];
  skipped: PaySeveralQuote["skipped"];
};

/** A pay plan with the winner of each picked lot, for deciding a payment from it. */
export type PlannedPayment = {
  plan: PayPlan;
  winners: ReadonlyMap<string, string | null>;
};

/** The read behind the Pay page: what one payment of the picked lots covers, and whether to offer it. */
export interface IPayPlanService {
  /** Only reads: raises no invoice, opens no check and starts no checkout. */
  plan(actor: OrganisationMemberActor, lotIds: readonly string[]): BuyingResult<PayPlan>;
  /** The same plan with each lot's winner; also only reads. */
  planWithWinners(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PlannedPayment>;
}

/** The invoice of a won lot as a PDF, for the member who pays it. */
export type PurchaseInvoicePdf = { pdf: Buffer; filename: string };

export interface IPurchaseInvoicePdfService {
  render(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseInvoicePdf>;
}

/** The account details and reference of a bank transfer already chosen for the picked lots. */
export interface IPayTransferService {
  /** `null` while there is no transfer waiting for its money, or the provider cannot be read. */
  instructions(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<{ instructions: BankTransferInstructions | null }>;
}

/** Only where a payment under way for the picked lots stands: what a waiting page asks for. */
export interface IPayProgressReadService {
  progress(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<{ progress: PayPlanProgress | null }>;
}

/** "Pay several": the account's payers settle several invoices with one payment. */
export interface IPaySeveralService {
  /** What one payment of the picked invoices would cover; nothing is held or charged. */
  plan(actor: OrganisationMemberActor, lotIds: readonly string[]): BuyingResult<PaySeveralQuote>;
  /**
   * Holds the payable invoices in one payment and opens its checkout, provided the plan is still
   * the one shown (`pay_plan_changed` with the fresh plan otherwise).
   */
  pay(actor: OrganisationMemberActor, request: PaySeveralRequest): BuyingResult<PaySeveralStarted>;
}

/** The buyer's side of a courier quote. Only the account's payers take these steps. */
export interface IDeliveryQuoteService {
  request(
    actor: OrganisationMemberActor,
    lotId: string,
    destination: string,
  ): BuyingResult<PurchaseQuoteView>;
  accept(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseQuoteView>;
  withdraw(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseQuoteView>;
}

/** The saleroom team's side: pricing a requested quote, which tells the buyer it is ready. */
export interface IStaffDeliveryQuoteService {
  quote(input: {
    staffUserId: string;
    lotId: string;
    amount: string;
    note: string | null;
  }): BuyingResult<DeliveryQuoteRow>;
}

/** How to book a collection for a purchase: email for now, self-serve once switched on. */
export interface ICollectionBookingService {
  offer(actor: OrganisationMemberActor, lotId: string): BuyingResult<CollectionBookingOffer>;
}

/** A reported problem as the buyer sees it on the purchase. */
export type PurchaseProblemView = {
  id: string;
  /** The short reference quoted to the client services team. */
  reference: string;
  status: PurchaseProblemStatus;
  category: PurchaseProblemCategory;
  reportedAt: Date;
};

/** "Report a problem" on a paid purchase, for the members who follow it. */
export interface IPurchaseProblemService {
  /**
   * Opens a report for the purchase. Reporting again while a report is open returns it, so a
   * repeated send never opens a second case; `created` says which happened.
   */
  report(
    actor: OrganisationMemberActor,
    lotId: string,
    input: { category: PurchaseProblemCategory; message: string },
  ): BuyingResult<{ problem: PurchaseProblemView; created: boolean }>;
  /** The open report for the purchase, or `null`. */
  current(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseProblemView | null>;
}
