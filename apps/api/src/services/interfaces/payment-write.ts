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

export interface IPaymentWriteRepository {
  create(row: CreatePaymentRow): Promise<PaymentRecord>;
  findById(id: string): Promise<PaymentRecord | null>;
  findOpenByLotAndBuyer(lotId: string, buyerId: string): Promise<PaymentRecord | null>;
  updateStatus(id: string, status: PaymentRecord["status"]): Promise<void>;
  updateStripeChargeId(id: string, stripeChargeId: string): Promise<void>;
  updateStripePaymentIntentId(id: string, stripePaymentIntentId: string): Promise<void>;
  findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<PaymentRecord | null>;
  /** All payments (admin listing). */
  listAll(): Promise<PaymentRecord[]>;
  /** Payments where the user is the buyer (portfolio). */
  listByBuyerId(buyerId: string): Promise<PaymentRecord[]>;
  /** Pending rows created at least `hours` ago (admin SLA). */
  countPendingOlderThanHours(hours: number): Promise<number>;
  /** Pending payments with `created_at` strictly before `cutoff` (cron expiry). */
  listStalePendingBefore(cutoff: Date): Promise<{ id: string; lotId: string; buyerId: string }[]>;
  /** Sum captured payment amounts in `[start, end]`. */
  sumCapturedBetween(start: Date, end: Date): Promise<string>;

  applyCapturedInTransaction(
    tx: Database,
    id: string,
    opts: { stripeChargeId?: string | null },
  ): Promise<boolean>;
  applyRefundedInTransaction(
    tx: Database,
    id: string,
    stripeRefundId: string | null,
  ): Promise<boolean>;
}
