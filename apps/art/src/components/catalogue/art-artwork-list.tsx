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

/** List layout for the artworks catalogue — Bid's list row with Art's card content. */
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
          href={card.href}
          linkLabel={`${card.title} by ${card.artistName}`}
          data-testid="art-artwork-row"
          image={
            <ArtMediaImage
              src={card.imageUrl}
              alt=""
              label={ART_MEDIA_LABELS.artwork}
              aspect={[1, 1]}
              sizes="96px"
              className="absolute inset-0 size-full"
              imgClassName="object-cover"
            />
          }
          title={card.title}
          subtitle={
            <div className="flex flex-col gap-0.5">
              <Link
                href={card.artistHref}
                className="art-focus-ring w-fit rounded-sm hover:text-on-surface"
              >
                {card.artistName}
              </Link>
              {card.metaLine ? <p className="line-clamp-1">{card.metaLine}</p> : null}
            </div>
          }
          trailing={
            <ArtArtworkFavoriteToggle
              slug={card.slug}
              title={card.title}
              initialSaved={card.saved}
              auth={favoriteAuth}
            />
          }
          footer={
            <>
              {card.priceLabel ? (
                <p className="text-sm font-medium text-on-surface">{card.priceLabel}</p>
              ) : (
                <span />
              )}
              {card.enquireHref ? (
                <Button variant="underline" asChild>
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
