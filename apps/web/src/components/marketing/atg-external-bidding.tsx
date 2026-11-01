import { atgCatalogState } from "@/lib/catalog/atg-catalog-display";
import {
  ATG_RESULT_PENDING_LABEL,
  atgLiveBidLabel,
  atgWhiteLabelUrl,
} from "@/lib/catalog/atg-white-label";
import type { Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { isAtgOwnedCatalogSale } from "@auction/validators";
import { ExternalLinkIcon } from "lucide-react";

type Props = {
  sale: Pick<Sale, "status" | "sellingPlatform" | "atgAuctionState" | "atgDistribution">;
  /** Lot pages: shorter copy, plus the ATG result once bidding has ended. */
  lot?: { sold: boolean | undefined };
};

function lotResultCopy(sold: boolean | undefined): string {
  if (sold === true) return "This lot sold on ATG.";
  if (sold === false) return "This lot did not sell on ATG.";
  return "Bidding on this lot has closed.";
}

/** Read-only lax.bid catalogue: bidding and registration happen on the ATG White Label. */
export function AtgExternalBiddingPanel({ sale, lot }: Props) {
  const state = atgCatalogState(sale);
  if (!state) return null;
  const url = atgWhiteLabelUrl();
  const host = url.host;
  const live = state === "live";

  let copy: string;
  if (live) {
    copy = lot
      ? `Bidding on this lot takes place on ${host}.`
      : `Bidding and registration for this sale take place on ${host}, not on lax.bid.`;
  } else {
    copy = lot ? lotResultCopy(lot.sold) : `Bidding on this sale has closed on ${host}.`;
  }

  return (
    <section
      className="space-y-3 rounded-lg border border-border-hairline bg-surface-container-low px-4 py-4"
      aria-label={live ? "Bidding on ATG" : "ATG results"}
    >
      <p className="font-label text-xs uppercase tracking-wide text-on-surface-variant">
        {live ? atgLiveBidLabel() : ATG_RESULT_PENDING_LABEL}
      </p>
      <p className="text-sm text-on-surface">{copy}</p>
      <Button asChild className="w-full sm:w-auto" variant={live ? "default" : "outline"}>
        <a href={url.toString()} target="_blank" rel="noopener noreferrer">
          {live ? `Bid on ${host}` : `View on ${host}`}
          <ExternalLinkIcon className="ml-2 size-4" aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </Button>
    </section>
  );
}

export function isAtgReadOnlyCatalogSale(
  sale: Pick<Sale, "status" | "sellingPlatform" | "atgDistribution"> | null | undefined,
): boolean {
  return sale != null && isAtgOwnedCatalogSale(sale);
}
