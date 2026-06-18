import "server-only";

import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import type { PaymentStatus } from "@auction/types";
import { authedServerFetch } from "./authed-fetch.server";

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

/** Fetch the signed-in buyer's payments. Personal data — never cached. */
export async function getServerMyPayments(
  params: MyPaymentsListParams = {},
): Promise<MyPaymentRow[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(`/payments/me${suffix}`, { cache: "no-store" });
  await throwIfNotOk(res, "payments");
  const body = (await res.json()) as { data: MyPaymentRow[] };
  return body.data;
}

export type ComplianceGateStatus = "clear" | "aml_hold" | "source_of_funds_required";

/**
 * Buyer pre-flight compliance gate. Returns the user-level compliance status
 * without requiring an existing payment row — used by checkout + portfolio to
 * surface blockers proactively. Fails open (returns "clear") on network error
 * so the buyer can still attempt checkout and see the block on submit.
 */
export async function getServerBuyerComplianceGate(): Promise<ComplianceGateStatus> {
  try {
    const res = await authedServerFetch("/payments/me/compliance-gate", { cache: "no-store" });
    if (!res.ok) return "clear";
    const body = (await res.json()) as { data: { status: ComplianceGateStatus } };
    const s = body.data?.status;
    return s === "aml_hold" || s === "source_of_funds_required" ? s : "clear";
  } catch {
    return "clear";
  }
}

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

function parseLotFulfilmentSnapshot(raw: unknown): LotFulfilmentSnapshot {
  const o = raw as Record<string, unknown>;
  const method = o.fulfilmentMethod;
  return {
    id: String(o.id ?? ""),
    lotId: String(o.lotId ?? ""),
    status: String(o.status ?? ""),
    paymentId: o.paymentId == null ? null : String(o.paymentId),
    fulfilmentMethod: method === "collection" || method === "shipping" ? method : null,
    shippingCarrier: o.shippingCarrier == null ? null : String(o.shippingCarrier),
    trackingNumber: o.trackingNumber == null ? null : String(o.trackingNumber),
    collectedBy: o.collectedBy == null ? null : String(o.collectedBy),
    collectedAt: o.collectedAt == null ? null : String(o.collectedAt),
  };
}

/** Winner checkout: current fulfilment / logistics state for the lot. */
export async function getServerLotFulfilmentForWinner(
  lotId: string,
): Promise<LotFulfilmentSnapshot | null> {
  const res = await authedServerFetch(`/payments/me/lot/${encodeURIComponent(lotId)}/fulfilment`, {
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return null;
    throw new Error(`Failed to load fulfilment: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown };
  if (body.data == null) return null;
  return parseLotFulfilmentSnapshot(body.data);
}
