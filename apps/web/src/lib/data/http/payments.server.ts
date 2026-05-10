import "server-only";

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
  if (!res.ok) {
    throw new Error(`Failed to load payments: ${res.status}`);
  }
  const body = (await res.json()) as { data: MyPaymentRow[] };
  return body.data;
}
