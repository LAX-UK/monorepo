import { toObjectRecord } from "@/lib/data/http/object-guards";
import type { PaymentStatus } from "@auction/types";
import { z } from "zod";

/** DTO returned by `GET /payments/me`.
 * Mirrors `MyPaymentRowDTO` in the API. Kept narrow on purpose — the buyer
 * dashboard does not need Stripe identifiers or seller-side metadata.
 */
export type MyPaymentRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  lotImageUrl: string | null;
  amount: string;
  platformFee: string;
  currency: "GBP";
  status: PaymentStatus;
  /** ISO-8601 string. Parsed lazily by the view-model. */
  createdAt: string;
  invoiceUrl: string | null;
  invoiceNumber: string | null;
  checkoutRail: "card" | "gb_bank_transfer" | null;
  manualReviewReason:
    | "seller_archived"
    | "high_value"
    | "seller_archived_and_high_value"
    | "aml_hold"
    | "source_of_funds_required"
    | "finance_release_required"
    | null;
};

export type MyPaymentsListParams = {
  status?: PaymentStatus;
};

export type ComplianceGateStatus = "clear" | "aml_hold" | "source_of_funds_required";

/** Winner checkout: current fulfilment / logistics state for the lot. */
export type LotFulfilmentSnapshot = {
  id: string;
  lotId: string;
  status: string;
  paymentId: string | null;
  fulfilmentMethod: "collection" | "shipping" | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  collectedBy: string | null;
  collectedAt: string | null;
};

const manualReviewReasons = [
  "seller_archived",
  "high_value",
  "seller_archived_and_high_value",
  "aml_hold",
  "source_of_funds_required",
  "finance_release_required",
] as const;

const paymentStatusSchema = z.enum([
  "pending",
  "authorized",
  "captured",
  "refunded",
  "requires_manual_review",
]);

export const myPaymentRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): MyPaymentRow => {
    const statusResult = paymentStatusSchema.safeParse(row.status);
    const manualReview = row.manualReviewReason;
    return {
      id: String(row.id ?? ""),
      lotId: String(row.lotId ?? ""),
      lotTitle: String(row.lotTitle ?? ""),
      lotImageUrl: row.lotImageUrl == null ? null : String(row.lotImageUrl),
      amount: String(row.amount ?? ""),
      platformFee: String(row.platformFee ?? ""),
      currency: "GBP",
      status: statusResult.success ? statusResult.data : "pending",
      createdAt: String(row.createdAt ?? ""),
      invoiceUrl: row.invoiceUrl == null ? null : String(row.invoiceUrl),
      invoiceNumber: row.invoiceNumber == null ? null : String(row.invoiceNumber),
      checkoutRail:
        row.checkoutRail === "card" || row.checkoutRail === "gb_bank_transfer"
          ? row.checkoutRail
          : null,
      manualReviewReason:
        typeof manualReview === "string" &&
        (manualReviewReasons as readonly string[]).includes(manualReview)
          ? (manualReview as MyPaymentRow["manualReviewReason"])
          : null,
    };
  }) as z.ZodType<MyPaymentRow>;

const complianceGateStatusSchema = z.enum(["clear", "aml_hold", "source_of_funds_required"]);

export const complianceGateEnvelopeSchema = z.object({
  status: complianceGateStatusSchema,
});

export const lotFulfilmentSnapshotSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): LotFulfilmentSnapshot => {
    const method = row.fulfilmentMethod;
    return {
      id: String(row.id ?? ""),
      lotId: String(row.lotId ?? ""),
      status: String(row.status ?? ""),
      paymentId: row.paymentId == null ? null : String(row.paymentId),
      fulfilmentMethod: method === "collection" || method === "shipping" ? method : null,
      shippingCarrier: row.shippingCarrier == null ? null : String(row.shippingCarrier),
      trackingNumber: row.trackingNumber == null ? null : String(row.trackingNumber),
      collectedBy: row.collectedBy == null ? null : String(row.collectedBy),
      collectedAt: row.collectedAt == null ? null : String(row.collectedAt),
    };
  }) as z.ZodType<LotFulfilmentSnapshot>;

export const nullableLotFulfilmentSnapshotSchema = lotFulfilmentSnapshotSchema.nullable();
