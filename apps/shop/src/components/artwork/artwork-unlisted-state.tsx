import { ArtworkDetailState } from "@/components/artwork/artwork-detail-state";
import { CatalogueGrid } from "@/components/catalogue-grid";
import { EDITION_UNLISTED_COPY } from "@/content/artwork-edition-copy";
import { FOCUS_RING } from "@auction/branding";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { cn } from "@auction/ui";
import Link from "next/link";

/** A removed or unlisted edition: says so, and offers other editions and the newest ones. */
export function ArtworkUnlistedState({ editions }: { editions: readonly PublicArtworkSummary[] }) {
  return (
    <ArtworkDetailState
      motif="ticket"
      eyebrow={EDITION_UNLISTED_COPY.eyebrow}
      title={EDITION_UNLISTED_COPY.title}
      description={EDITION_UNLISTED_COPY.description}
    >
      <Link href="/artworks?sort=newest" className={cn("shop-inline-link", FOCUS_RING)}>
        {EDITION_UNLISTED_COPY.newEditionsLink}
      </Link>
      {editions.length > 0 ? (
        <section aria-labelledby="unlisted-more-heading">
          <h2 id="unlisted-more-heading">{EDITION_UNLISTED_COPY.moreTitle}</h2>
          <CatalogueGrid items={editions} titleLevel={3} />
        </section>
      ) : null}
    </ArtworkDetailState>
  );
}
