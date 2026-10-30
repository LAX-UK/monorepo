import { ArtArtworkCard } from "@/components/catalogue/art-artwork-card";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import type { ArtistWorksLayout } from "@/lib/artist/artist-profile.vm";
import type { CatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { MarketingCardReveal } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type ArtArtistWorksProps = {
  cards: readonly CatalogueArtworkCardVm[];
  layout: ArtistWorksLayout;
  favoriteAuth: ArtFavoriteAuth;
  "aria-label": string;
  /** Beside a single work: what to do next, so the row never ends in empty space. */
  aside?: ReactNode;
};

/**
 * An artist's works, recomposed for their count: the works grid from three, two at half width,
 * and one beside the `aside` panel.
 */
export function ArtArtistWorks({
  cards,
  layout,
  favoriteAuth,
  "aria-label": ariaLabel,
  aside,
}: ArtArtistWorksProps) {
  if (layout === "grid") {
    return (
      <ArtArtworkGrid
        cards={cards}
        favoriteAuth={favoriteAuth}
        aria-label={ariaLabel}
        // Three works fill a row of three rather than three quarters of a row of four.
        {...(cards.length === 3 ? { className: "xl:grid-cols-3" } : {})}
      />
    );
  }
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-8 lg:gap-x-6",
        // One work at a little under half width, its invitation beside it.
        layout === "single" && "sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-x-12",
      )}
      data-layout={layout}
      data-testid="art-artist-works"
    >
      <ul
        aria-label={ariaLabel}
        className={
          layout === "pair"
            ? "col-span-2 grid grid-cols-2 gap-x-4 gap-y-8 lg:gap-x-6"
            : "col-span-2 sm:col-span-1"
        }
      >
        {cards.map((card, index) => (
          <li key={card.slug} className="min-w-0">
            <MarketingCardReveal index={index}>
              <ArtArtworkCard card={card} favoriteAuth={favoriteAuth} />
            </MarketingCardReveal>
          </li>
        ))}
      </ul>
      {layout === "single" && aside ? (
        <div className="col-span-2 flex flex-col justify-center sm:col-span-1">{aside}</div>
      ) : null}
    </div>
  );
}
