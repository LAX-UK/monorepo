import { MarketingArrowUpRightIcon } from "@auction/marketing-ui";

/**
 * lax.art takes no consignments: a collector who owns a work by the artist sells it through LAX
 * Bid's "Sell with LAX". One quiet line, so it never competes with the enquiry below it.
 */
export function ArtArtistSellNote({ artistName, href }: { artistName: string; href: string }) {
  return (
    <aside
      aria-label="Selling a work"
      className="flex flex-col gap-3 border-y border-border-hairline py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8"
      data-testid="art-artist-sell-note"
    >
      <p className="text-base leading-7 text-on-surface-variant">
        <span className="font-medium text-on-surface">Own a work by {artistName}?</span> Sell it at
        auction with LAX Bid; a specialist values it and guides you to the sale.
      </p>
      <a
        href={href}
        className="art-focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-sm text-sm font-medium text-on-surface underline underline-offset-4 hover:decoration-2"
      >
        Sell with LAX
        <span className="sr-only"> on LAX Bid</span>
        <MarketingArrowUpRightIcon className="size-4" />
      </a>
    </aside>
  );
}
