import type { Database } from "@auction/db";

export type CreatePaymentRow = {
  lotId: string;
  paidByUserId: string;
  buyerLegalEntityId: string;
  sellerLegalEntityId: string;
  amount: string;
  platformFee: string;
  stripePaymentIntentId: string | null;
  stripeChargeId?: string | null;
  status?: PaymentRecord["status"];
};

export type PaymentRecord = {
  id: string;
  lotId: string;
  buyerId?: string;
  sellerId?: string;
  paidByUserId?: string;
  buyerLegalEntityId?: string;
  sellerLegalEntityId?: string;
  amount: string;
  platformFee: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeRefundId: string | null;
  status:
    | "pending"
    | "authorized"
    | "captured"
    | "refunded"
    | "requires_manual_review"
    | "cancelled";
  createdAt: Date;
  /** The "Pay several" payment this invoice is settled through, if any. */
  paymentGroupId?: string | null;
  /** Populated for admin listing when a Xero invoice row exists. */
  xeroInvoiceNumber?: string | null;
  xeroOnlineInvoiceUrl?: string | null;
  xeroSyncStatus?: "pending_sync" | "synced" | "error" | null;
  xeroLastError?: string | null;
};

export type ListPaymentsExportFilter = {
  status?: PaymentRecord["status"];
  manualReview?: boolean;
};

export type ListPaymentsAdminTableFilter = {
  status?: PaymentRecord["status"];
  /** Case-insensitive match on payment id, buyer id/name/email, lot title, fulfilment status. */
  q?: string;
  /** Lot fulfilment statuses; a payment matches when its lot's fulfilment is any of them. */
  fulfilmentStatuses?: readonly string[];
  /** Xero invoice state: an invoice number is linked, none is, or the last sync failed. */
  xeroInvoice?: "linked" | "missing" | "sync_error";
  limit: number;
  offset: number;
};

export type AdminPaymentTableRowDto = PaymentRecord & {
  lotTitle: string;
  /** The lot's number in its sale, for the list's second line ("Lot 12 · Autumn sale"). */
  lotNumber?: number | null;
  saleTitle?: string | null;
  buyerLabel: string | null;
  fulfilmentStatus: string | null;
  buyerId: string;
  sellerId: string;
};

/** One day's payment amounts in pence, by the status the payments are in now. */
export type AdminPaymentsDailyAmounts = {
  volume: number;
  captured: number;
  refunded: number;
  /** Pending or authorised: money not yet taken. */
  awaiting: number;
};

export type AdminPaymentsSummaryStats = {
  totalVolume: string;
  captured: string;
  pending: string;
  refunded: string;
};

export interface IPaymentReadRepository {
  findById(id: string): Promise<PaymentRecord | null>;
  findOpenByLotAndBuyer(lotId: string, buyerId: string): Promise<PaymentRecord | null>;
  findRefundedByLotAndBuyer(lotId: string, buyerId: string): Promise<PaymentRecord | null>;
  /**
   * The open (or captured) payment for a lot billed to an account, whichever member started it.
   * An organisation's purchase can be paid by any of its payers, so checkout looks it up by account.
   */
  findOpenByLotAndBuyerAccount(
    lotId: string,
    buyerLegalEntityId: string,
  ): Promise<PaymentRecord | null>;
  /** A refunded payment for a lot billed to an account, whichever member paid it. */
  findRefundedByLotAndBuyerAccount(
    lotId: string,
    buyerLegalEntityId: string,
  ): Promise<PaymentRecord | null>;
  findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<PaymentRecord | null>;
  /** All payments (admin listing). */
  listAll(): Promise<PaymentRecord[]>;
  /** Paginated admin export with optional status / manual-review filters. */
  listForExport(
    filter: ListPaymentsExportFilter & { limit: number; offset: number },
  ): Promise<PaymentRecord[]>;
  countForExport(filter: ListPaymentsExportFilter): Promise<number>;
  /** Payments where the user is the buyer (portfolio). */
  listByBuyerId(buyerId: string): Promise<PaymentRecord[]>;
  /** Payments billed to an organisation (or personal entity) as buyer, whoever placed the winning bid. */
  listByBuyerLegalEntityId(legalEntityId: string): Promise<PaymentRecord[]>;
  /** Paginated admin payments table (with optional status/search). */
  listForAdminTable(filter: ListPaymentsAdminTableFilter): Promise<AdminPaymentTableRowDto[]>;
  countForAdminTable(
    filter: Omit<ListPaymentsAdminTableFilter, "limit" | "offset">,
  ): Promise<number>;
}

export interface IPaymentMutationRepository {
  create(row: CreatePaymentRow): Promise<PaymentRecord>;
  updateStatus(id: string, status: PaymentRecord["status"]): Promise<void>;
  updateStripeChargeId(id: string, stripeChargeId: string): Promise<void>;
  updateStripePaymentIntentId(id: string, stripePaymentIntentId: string): Promise<void>;
}

export interface IPaymentLifecycleRepository {
  /** Pending rows created at least `hours` ago (admin SLA). */
  countPendingOlderThanHours(hours: number): Promise<number>;
  /** Pending payments with `created_at` strictly before `cutoff` (cron expiry). */
  listStalePendingBefore(cutoff: Date): Promise<{ id: string; lotId: string; buyerId: string }[]>;
  /** Authorized (in-flight bank transfer) payments with `created_at` strictly before `cutoff`. */
  listStaleAuthorizedBefore(
    cutoff: Date,
  ): Promise<{ id: string; lotId: string; buyerId: string }[]>;
  applyCapturedInTransaction(
    tx: Database,
    id: string,
    opts: { stripeChargeId?: string | null },
  ): Promise<boolean>;
  /** Atomically move pending → authorized (bank transfer in flight). */
  applyAuthorizedInTransaction(tx: Database, id: string): Promise<boolean>;
  /** Atomically cancel an open payment (pending or authorized). */
  applyCancelledInTransaction(tx: Database, id: string): Promise<boolean>;
  applyRefundedInTransaction(
    tx: Database,
    id: string,
    stripeRefundId: string | null,
  ): Promise<boolean>;
  /** Atomically move a payment from manual review to pending (finance release). */
  applyReleasedFromManualReviewInTransaction(tx: Database, id: string): Promise<boolean>;
}

export interface IPaymentAnalyticsRepository {
  /** Sum captured payment amounts in `[start, end]`. */
  sumCapturedBetween(start: Date, end: Date): Promise<string>;
  /** UTC day counts for admin KPI trends (created_at >= rangeStart). */
  countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>>;
  summarizeForAdminTable(
    filter: Omit<ListPaymentsAdminTableFilter, "limit" | "offset">,
  ): Promise<AdminPaymentsSummaryStats>;
  /**
   * For the payments the admin table filter matches, created on or after `rangeStart`: the amount
   * created each UTC day, in pence, in total and split by where those payments are now (captured,
   * refunded, awaiting capture). Days without payments are absent.
   */
  sumAdminTableAmountsByDay(
    filter: Omit<ListPaymentsAdminTableFilter, "limit" | "offset">,
    rangeStart: Date,
  ): Promise<Map<string, AdminPaymentsDailyAmounts>>;
}

/** Full payment persistence port — composite of segregated slices (ISP). Name kept for backward compatibility. */
export interface IPaymentWriteRepository
  extends IPaymentReadRepository,
    IPaymentMutationRepository,
    IPaymentLifecycleRepository,
    IPaymentAnalyticsRepository {}
