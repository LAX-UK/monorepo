import { formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { lotWasSold } from "@/lib/lot/lot-outcome";
import type { LotStatusContext } from "@/lib/presenters/status/core";
import type { Lot } from "@auction/types";

type ArchiveLotSource = Pick<
  Lot,
  "status" | "winnerId" | "currentPrice" | "lotNumber" | "marketingDetails"
> & {
  hasWinner?: boolean;
};

/** What an archive card says about one past lot. */
export type ArchiveLotResultVM = {
  /** Outcome context for the lot status badge (Sold / Unsold). */
  statusContext: LotStatusContext;
  /** The hammer price of a sold lot; null when the lot did not sell. */
  hammer: { label: string; value: string } | null;
  /** The catalogue lot number ("Lot 4"); null when the lot has none. */
  lotNumberLabel: string | null;
};

/**
 * One reading of a past lot for every archive view. Public lists hide the buyer and carry only
 * `hasWinner`, so both flags feed the outcome; an unsold lot shows no price, because its last bid
 * is not a hammer price.
 */
export function archiveLotResult(lot: ArchiveLotSource): ArchiveLotResultVM {
  const sold = lotWasSold(lot);
  return {
    statusContext: {
      winnerId: lot.winnerId ?? null,
      hasWinner: sold,
    },
    hammer: sold
      ? { label: "Hammer price", value: formatMoney(lot.currentPrice, lotChargeCurrency(lot)) }
      : null,
    lotNumberLabel: lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null,
  };
}
