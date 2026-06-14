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
  limit: number;
  offset: number;
};

export type AdminPaymentTableRowDto = PaymentRecord & {
  lotTitle: string;
  buyerLabel: string | null;
  fulfilmentStatus: string | null;
  buyerId: string;
  sellerId: string;
};

export type AdminPaymentsSummaryStats = {
  totalVolume: string;
  captured: string;
  pending: string;
  refunded: string;
};

export interface IPaymentWriteRepository {
  create(row: CreatePaymentRow): Promise<PaymentRecord>;
  findById(id: string): Promise<PaymentRecord | null>;
  findOpenByLotAndBuyer(lotId: string, buyerId: string): Promise<PaymentRecord | null>;
  findRefundedByLotAndBuyer(lotId: string, buyerId: string): Promise<PaymentRecord | null>;
  updateStatus(id: string, status: PaymentRecord["status"]): Promise<void>;
  updateStripeChargeId(id: string, stripeChargeId: string): Promise<void>;
  updateStripePaymentIntentId(id: string, stripePaymentIntentId: string): Promise<void>;
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
  /** Pending rows created at least `hours` ago (admin SLA). */
  countPendingOlderThanHours(hours: number): Promise<number>;
  /** Pending payments with `created_at` strictly before `cutoff` (cron expiry). */
  listStalePendingBefore(cutoff: Date): Promise<{ id: string; lotId: string; buyerId: string }[]>;
  /** Authorized (in-flight bank transfer) payments with `created_at` strictly before `cutoff`. */
  listStaleAuthorizedBefore(
    cutoff: Date,
  ): Promise<{ id: string; lotId: string; buyerId: string }[]>;
  /** Sum captured payment amounts in `[start, end]`. */
  sumCapturedBetween(start: Date, end: Date): Promise<string>;
  /** UTC day counts for admin KPI trends (created_at >= rangeStart). */
  countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>>;
  /** Paginated admin payments table (with optional status/search). */
  listForAdminTable(filter: ListPaymentsAdminTableFilter): Promise<AdminPaymentTableRowDto[]>;
  countForAdminTable(
    filter: Omit<ListPaymentsAdminTableFilter, "limit" | "offset">,
  ): Promise<number>;
  summarizeForAdminTable(
    filter: Omit<ListPaymentsAdminTableFilter, "limit" | "offset">,
  ): Promise<AdminPaymentsSummaryStats>;

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
