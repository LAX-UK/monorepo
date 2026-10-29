import { ShopArtistCard } from "@/components/artists/shop-artist-card";
import { CatalogueResultsRow } from "@/components/catalogue/catalogue-results";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopSection } from "@/components/layout/shop-section";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { buildCatalogueArtistCards } from "@/lib/catalogue/catalogue-artist-card.vm";
import type {
  CatalogueNoMatchVm,
  CatalogueSuggestionsVm,
} from "@/lib/catalogue/catalogue-page.composer";
import { MarketingArtistGrid } from "@auction/marketing-ui";
import type { PublicArtistSummary } from "@auction/shop-contracts";
import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";
import Link from "next/link";

const HELP_HREF = "/help";

/** The hatched placeholder in a small work-shaped frame, in place of a drawing. */
function PlaceholderMotif({ label }: { label: string }) {
  return (
    <span className="shop-catalogue-state__placeholder" aria-hidden="true">
      <MediaPlaceholder label={label} fill />
    </span>
  );
}

/** "Available now" under a state that found nothing, so the page never ends empty. */
function AvailableNow({ suggestions }: { suggestions: CatalogueSuggestionsVm }) {
  return (
    <ShopSection
      id="catalogue-available-now"
      title="Available now"
      className="shop-catalogue-state__more"
      {...(suggestions.viewAll
        ? {
            viewAll: {
              href: suggestions.viewAll.href,
              label: suggestions.viewAll.label,
              srLabel: "editions on sale",
            },
          }
        : {})}
    >
      <CatalogueResultsRow items={suggestions.items} titleAs="h3" />
    </ShopSection>
  );
}

/** Filters that give nothing: take the last one off, clear them all, or see what is on sale. */
export function CatalogueNoMatch({ noMatch }: { noMatch: CatalogueNoMatchVm }) {
  return (
    <div className="shop-catalogue-state">
      <ShopStatusState
        variant="empty"
        layout="open"
        titleAs="h2"
        motifSlot={<PlaceholderMotif label="Editions" />}
        title="No editions match these filters"
        description="Remove a filter, or clear them all to see every edition."
        announcement="polite"
        actions={
          <>
            {noMatch.remove ? (
              <ShopStatusStateLink href={noMatch.remove.href} priority="primary">
                {`Remove “${noMatch.remove.label}”`}
              </ShopStatusStateLink>
            ) : null}
            <ShopStatusStateLink href={noMatch.clearHref}>Clear all filters</ShopStatusStateLink>
          </>
        }
      />
      {noMatch.availableNow ? <AvailableNow suggestions={noMatch.availableNow} /> : null}
    </div>
  );
}

/** Nothing on sale anywhere: no rail, the promise of new editions and the way to originals. */
export function CatalogueEmpty({ artHref }: { artHref: string | null }) {
  return (
    <ShopStatusState
      variant="empty"
      layout="open"
      titleAs="h2"
      motifSlot={<PlaceholderMotif label="New editions" />}
      title="New editions are on their way"
      description="The gallery’s artists are preparing the next releases. Original works are on lax.art in the meantime."
      actions={
        artHref ? (
          <ShopStatusStateLink href={artHref} priority="primary">
            See original works on lax.art
          </ShopStatusStateLink>
        ) : (
          <ShopStatusStateLink href={HELP_HREF}>Help and contact</ShopStatusStateLink>
        )
      }
    />
  );
}

/** The editions could not be read: try again, or reach the gallery. */
export function CatalogueUnavailable() {
  return (
    <ShopStatusState
      variant="error"
      layout="open"
      titleAs="h2"
      title="Editions are unavailable right now"
      description="We could not load the editions. Try again in a moment."
      announcement="polite"
      actions={
        <>
          <ShopCatalogueStateRetryButton />
          <ShopStatusStateLink href={HELP_HREF}>Help and contact</ShopStatusStateLink>
        </>
      }
    />
  );
}

export type CatalogueSearchEmptyProps = {
  didYouMean: { term: string; href: string } | null;
  artists: readonly PublicArtistSummary[];
  availableNow: CatalogueSuggestionsVm | null;
};

/**
 * A search with no editions: what it may have meant, the artists it does match, what is on sale
 * now, and help for anyone who was looking for delivery, returns or an order.
 */
export function CatalogueSearchEmpty({
  didYouMean,
  artists,
  availableNow,
}: CatalogueSearchEmptyProps) {
  const artistCards = buildCatalogueArtistCards([...artists]);
  return (
    <div className="shop-catalogue-state">
      <p className="shop-catalogue-state__lead">
        {didYouMean ? (
          <>
            Did you mean{" "}
            <Link href={didYouMean.href} className="shop-inline-link shop-focus-ring">
              {didYouMean.term}
            </Link>
            ? Or try an artist’s name or a title.
          </>
        ) : (
          "Check the spelling, or try an artist’s name or a title."
        )}
      </p>
      {artistCards.length > 0 ? (
        <ShopSection
          id="catalogue-search-artists"
          title="Artists"
          viewAll={{ href: "/artists", label: "All artists", srLabel: "with editions" }}
        >
          <MarketingArtistGrid aria-label="Artists">
            {artistCards.map((card) => (
              <ShopArtistCard key={card.id} card={card} />
            ))}
          </MarketingArtistGrid>
        </ShopSection>
      ) : null}
      {availableNow ? <AvailableNow suggestions={availableNow} /> : null}
      <p className="shop-catalogue-state__help">
        Looking for delivery, returns or an order?{" "}
        <Link href={HELP_HREF} className="shop-inline-link shop-focus-ring">
          Help and contact
        </Link>
      </p>
    </div>
  );
}
