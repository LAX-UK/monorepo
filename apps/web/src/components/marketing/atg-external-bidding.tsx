import type { Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { isAtgOwnedCatalogSale } from "@auction/validators";
import { ExternalLinkIcon } from "lucide-react";

type Props = {
  sale: Pick<Sale, "status" | "sellingPlatform">;
  /** Shown under the button on lot pages. */
  compact?: boolean;
};

function atgWhiteLabelHref(): string {
  return process.env.ATG_WHITE_LABEL_BASE_URL?.trim() || "https://auctions.lax.bid";
}

/** Read-only lax.bid catalogue: bidding happens on the ATG White Label. */
export function AtgExternalBiddingPanel({ sale, compact = false }: Props) {
  if (!isAtgOwnedCatalogSale(sale)) return null;
  const href = atgWhiteLabelHref();
  const live = sale.sellingPlatform === "atg";

  return (
    <section
      className="space-y-3 rounded-lg border border-border-hairline bg-surface-container-low px-4 py-4"
      aria-label="Bidding on ATG"
    >
      <p className="font-label text-xs uppercase tracking-wide text-on-surface-variant">
        {live ? "Live on ATG" : "Ended on ATG"}
      </p>
      <p className="text-sm text-on-surface">
        {compact
          ? "This lot is offered on the ATG White Label. Bidding and registration take place there."
          : "This sale is offered on the ATG White Label. Bidding and registration take place on auctions.lax.bid, not on lax.bid."}
      </p>
      <Button asChild className="w-full sm:w-auto">
        <a href={href} target="_blank" rel="noreferrer">
          Bid on auctions.lax.bid
          <ExternalLinkIcon className="ml-2 size-4" aria-hidden />
        </a>
      </Button>
    </section>
  );
}

export function isAtgReadOnlyCatalogSale(
  sale: Pick<Sale, "status" | "sellingPlatform"> | null | undefined,
): boolean {
  return sale != null && isAtgOwnedCatalogSale(sale);
}
