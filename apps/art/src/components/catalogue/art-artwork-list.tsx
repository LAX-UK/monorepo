import { ArtArtworkFavoriteToggle } from "@/components/favorites/art-artwork-favorite-toggle.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { CatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingCatalogList, MarketingCatalogListRow } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export type ArtArtworkListProps = {
  cards: readonly CatalogueArtworkCardVm[];
  favoriteAuth: ArtFavoriteAuth;
  "aria-label"?: string;
};

/**
 * Figma list row (`881:21543`): landscape media, title and artist, then a divided column with
 * price, heart and an outline Enquire. The mobile row (`905:22299`) keeps only thumb, title,
 * artist and price, so the heart and Enquire appear from `md`.
 */
export function ArtArtworkList({
  cards,
  favoriteAuth,
  "aria-label": ariaLabel,
}: ArtArtworkListProps) {
  return (
    <MarketingCatalogList aria-label={ariaLabel} data-testid="art-artwork-list">
      {cards.map((card) => (
        <MarketingCatalogListRow
          key={card.slug}
          size="lg"
          href={card.href}
          linkLabel={`${card.title} by ${card.artistName}`}
          data-testid="art-artwork-row"
          image={
            <ArtMediaImage
              src={card.imageUrl}
              alt=""
              label={ART_MEDIA_LABELS.artwork}
              aspect={[4, 3]}
              sizes="(min-width: 64rem) 260px, (min-width: 48rem) 192px, 80px"
              className="absolute inset-0 size-full"
              imgClassName="object-cover"
            />
          }
          title={card.title}
          subtitle={
            <Link
              href={card.artistHref}
              className="art-focus-ring inline-flex min-h-6 w-fit items-center rounded-sm hover:text-on-surface"
            >
              {card.artistName}
            </Link>
          }
          aside={
            <>
              <div className="flex items-center justify-between gap-3 md:min-h-11">
                {card.priceLabel ? (
                  <p className="text-xs font-medium text-on-surface md:text-sm md:font-semibold">
                    {card.priceLabel}
                  </p>
                ) : (
                  <span />
                )}
                <ArtArtworkFavoriteToggle
                  slug={card.slug}
                  title={card.title}
                  initialSaved={card.saved}
                  auth={favoriteAuth}
                  appearance="bare"
                  size="sm"
                  className="-mr-2.5 hidden md:inline-flex"
                />
              </div>
              {card.enquireHref ? (
                <Button variant="secondaryOutline" className="hidden w-full md:inline-flex" asChild>
                  <Link href={card.enquireHref}>
                    Enquire<span className="sr-only"> about {card.title}</span>
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />
      ))}
    </MarketingCatalogList>
  );
}
