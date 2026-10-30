import { ArtArtworkFavoriteToggle } from "@/components/favorites/art-artwork-favorite-toggle.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { CatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingCatalogList, MarketingCatalogListRow } from "@auction/marketing-ui";
import Link from "next/link";

export type ArtArtworkListProps = {
  cards: readonly CatalogueArtworkCardVm[];
  favoriteAuth: ArtFavoriteAuth;
  "aria-label"?: string;
};

/**
 * Figma list row (`881:21543`): landscape media, title and artist, then a divided column with
 * price, heart and Enquire as a text link. Rows carry the same meta line as cards. The mobile row
 * (`905:22299`) keeps only thumb, title,
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
            <span className="flex flex-col gap-1">
              <Link
                href={card.artistHref}
                className="art-focus-ring inline-flex min-h-6 w-fit items-center rounded-sm hover:text-on-surface"
              >
                {card.artistName}
              </Link>
              {/* A list shows at least what a card shows: year, medium and size. */}
              {card.metaLine ? (
                <span className="text-on-surface-variant" data-testid="art-artwork-row-meta">
                  {card.metaLine}
                </span>
              ) : null}
            </span>
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
                <Link
                  href={card.enquireHref}
                  className="art-focus-ring hidden min-h-11 w-fit items-center rounded-sm text-sm font-medium text-on-surface underline underline-offset-4 hover:decoration-2 md:inline-flex"
                >
                  Enquire<span className="sr-only"> about {card.title}</span>
                </Link>
              ) : null}
            </>
          }
        />
      ))}
    </MarketingCatalogList>
  );
}
