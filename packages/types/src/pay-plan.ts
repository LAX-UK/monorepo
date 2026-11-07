import type { InvoiceLine, InvoiceLineKind } from "./payment.js";

/** Why a picked lot is not part of the payment. */
export type PayPlanLeftOutReason =
  /** Won for another account, or not a purchase of this account. */
  | "other_account"
  | "paid"
  /** Paid and being confirmed (a card authorisation, a bank transfer on its way). */
  | "being_confirmed"
  /** The person asking does not pay for this account's purchases. */
  | "not_payer"
  /** Waiting for a finance or compliance review; paid on its own once released. */
  | "held_for_review"
  /** Already part of another payment that is still open. */
  | "being_paid"
  /** The purchase was cancelled: the sale did not go ahead. */
  | "cancelled"
  | "refunded"
  /** The invoice was voided. */
  | "voided";

/**
 * Why the payment cannot be made yet. The first that applies, in this order: the person does not
 * pay for the account, the account has not finished onboarding, the account rule, anti-money
 * laundering and source-of-funds checks on the amount, then the finance check for large totals.
 */
export type PayPlanGate =
  | { kind: "clear" }
  | { kind: "not_payer"; payingAccountName: string }
  | { kind: "onboarding_required" }
  | { kind: "refused"; reason: "organisation_closed" }
  | { kind: "held"; reason: "identity_verification_required" | "organisation_under_review" }
  | {
      kind: "compliance";
      reason: "aml_hold" | "source_of_funds_required";
      subject: "payer" | "winner";
    }
  | { kind: "finance_check" };

export type PayPlanMethod = {
  method: "card" | "bank_transfer";
  available: boolean;
  /** Why it is unavailable: `null` while it is available. */
  reason: "over_card_limit" | "over_online_limit" | null;
};

/** One lot in a payment under way, as the Pay page lists it. */
export type PayPlanProgressLot = {
  lotId: string;
  title: string;
  lotNumber: number | null;
  saleTitle: string | null;
  /** The invoice total, in whole pence. */
  totalPence: number;
};

/**
 * A payment already under way for these lots: a card payment being confirmed, or a bank transfer
 * waiting for its money. Every figure is whole pence from the server's records.
 */
export type PayPlanProgress = {
  rail: "card" | "bank_transfer";
  stage: "confirming" | "awaiting_transfer" | "part_received";
  /** The lots of the link that this payment covers (it may cover more), with their invoice totals. */
  lots: PayPlanProgressLot[];
  totalPence: number;
  receivedPence: number;
  remainingPence: number;
  /** Whole percent received, rounded down. */
  receivedPercent: number;
};

/** Where to send a bank transfer, as the payment provider issued it for this payment. */
export type BankTransferInstructions = {
  accountName: string;
  sortCode: string;
  accountNumber: string;
  reference: string;
};

/** One invoice on the Pay page: its lines and total are the stored figures. */
export type PayPlanPayable = {
  lotId: string;
  /** The open payment; `null` while the lot is not invoiced yet but can be invoiced on payment. */
  paymentId: string | null;
  invoiceId: string | null;
  title: string;
  lotNumber: number | null;
  saleTitle: string | null;
  lines: InvoiceLine[];
  totalPence: number;
  /** ISO 8601 instant; the end of the London day the payment term runs to. */
  dueAt: string;
  overdue: boolean;
};

export type PayPlan = {
  account: { legalEntityId: string; kind: "individual" | "organisation"; name: string };
  payerRole: "payer" | "informed";
  /** The company that issues the invoices. */
  entity: { name: string; address: string; companyNumber: string | null; vatNumber: string | null };
  gate: PayPlanGate;
  payable: PayPlanPayable[];
  leftOut: { lotId: string; reason: PayPlanLeftOutReason }[];
  totals: { pence: number; byKind: { kind: InvoiceLineKind; pence: number }[] };
  /** ISO 8601 instant of the earliest due date among the payable invoices. */
  firstDueAt: string | null;
  methods: PayPlanMethod[];
  /** The most one card payment takes, in whole pence. */
  cardLimitPence: number;
  /** A payment already under way for any of these lots; `null` when none. */
  progress: PayPlanProgress | null;
  currency: "GBP";
};
