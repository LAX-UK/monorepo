import type { Lot, PaymentStatus } from "@auction/types";
import type { PaymentRecord } from "./interfaces/payment-write.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";

/** Buyer-facing payment row returned by `GET /payments/me`.
 *
 * Intentionally narrow: only the fields the buyer dashboard surfaces. Internal
 * Stripe identifiers and seller-side metadata are not exposed.
 */
export type MyPaymentRowDTO = {
  id: string;
  lotId: string;
  lotTitle: string;
  lotImageUrl: string | null;
  /** Total settlement amount including buyer's premium, as a string in GBP. */
  amount: string;
  platformFee: string;
  currency: "GBP";
  status: PaymentStatus;
  /** ISO-8601 timestamp of when the payment row was created. */
  createdAt: string;
  /** Hosted invoice URL (Xero) when an online invoice exists. */
  invoiceUrl: string | null;
  /** Xero invoice number when synced. */
  invoiceNumber: string | null;
};

/** Map domain payment rows + their lots to the buyer-facing DTO list.
 * Resolves the first lot image to a public URL via `mediaUrlResolver`.
 */
export async function presentMyPayments(
  rows: PaymentRecord[],
  lotById: Map<string, Lot>,
  mediaUrlResolver: MediaUrlResolver | undefined,
): Promise<MyPaymentRowDTO[]> {
  return Promise.all(
    rows.map(async (row) => {
      const lot = lotById.get(row.lotId);
      const firstImage = lot?.images[0];
      const lotImageUrl = firstImage
        ? mediaUrlResolver
          ? ((await mediaUrlResolver.resolveMany([firstImage]))[0] ?? null)
          : firstImage
        : null;
      return {
        id: row.id,
        lotId: row.lotId,
        lotTitle: lot?.title ?? "Removed lot",
        lotImageUrl,
        amount: row.amount,
        platformFee: row.platformFee,
        currency: "GBP" as const,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        invoiceUrl: row.xeroOnlineInvoiceUrl ?? null,
        invoiceNumber: row.xeroInvoiceNumber ?? null,
      };
    }),
  );
}
