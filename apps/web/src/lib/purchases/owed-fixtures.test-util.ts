import { type AccountHold, amountOwedEntry } from "@auction/domain";
import type { PurchaseSources } from "./purchases.vm";

/**
 * What the account owes for a set of rows, as the API's amounts-owed reading works it out: the
 * same domain rule, fed by each row's payment, its saleroom status and the account's open checks.
 */
export function owedFor(
  sources: Pick<PurchaseSources, "rows" | "fulfilmentByLot" | "paymentRoleByLot"> & {
    factsByLot?: PurchaseSources["factsByLot"];
  },
  gate: AccountHold = "clear",
): PurchaseSources["owedByLot"] {
  const entries = sources.rows.flatMap((candidate) => {
    const { lot, payment } = candidate;
    const cancelledOnDelivery = sources.factsByLot?.[lot.id]?.delivery.stage === "cancelled";
    const entry = amountOwedEntry(
      {
        lotId: lot.id,
        paymentStatus: payment?.status ?? null,
        fulfilmentStatus: cancelledOnDelivery
          ? "cancelled"
          : (sources.fulfilmentByLot[lot.id]?.status ?? null),
        paymentReviewReason: payment?.manualReviewReason ?? null,
        role: sources.paymentRoleByLot[lot.id] ?? "payer",
        amountDue: lot.checkoutPricing?.totalMajor ?? null,
        currency: "GBP",
      },
      gate,
    );
    return entry ? [[lot.id, entry] as const] : [];
  });
  return Object.fromEntries(entries);
}
