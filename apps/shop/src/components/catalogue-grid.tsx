import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { buildCatalogueArtworkCards } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingWorkCard, MarketingWorkGrid } from "@auction/marketing-ui";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import Link from "next/link";

type CatalogueGridProps = {
  items: PublicArtworkSummary[];
  /** Card titles are h2 on a listing page, h3 inside a titled section. */
  titleLevel?: 2 | 3;
  /** Leave out the artist line, e.g. on the artist's own page. */
  hideArtist?: boolean;
  "aria-label"?: string;
  className?: string;
};

/** Shop editions as the shared LAX works grid: each work shown whole on a mat. */
export function CatalogueGrid({
  items,
  titleLevel = 2,
  hideArtist = false,
  "aria-label": ariaLabel,
  className,
}: CatalogueGridProps) {
  if (items.length === 0) {
    return (
      <ShopStatusState
        variant="empty"
        title="No artworks found"
        description="There are no published works in this collection yet. Explore artists or categories in the meantime."
        actions={
          <>
            <ShopStatusStateLink href="/artists">Browse artists</ShopStatusStateLink>
            <ShopStatusStateLink href="/categories">Browse categories</ShopStatusStateLink>
          </>
        }
      />
    );
  }

  const cards = buildCatalogueArtworkCards(items);

  return (
    <MarketingWorkGrid
      {...(className ? { className } : {})}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
    >
      {cards.map((card) => (
        <MarketingWorkCard
          key={card.slug}
          href={card.href}
          title={card.title}
          titleAs={titleLevel === 3 ? "h3" : "h2"}
          media={
            <ShopMediaImage
              src={card.imageUrl}
              alt={card.imageAlt}
              label={SHOP_MEDIA_LABELS.artwork}
              sizes="(min-width: 80rem) 22vw, (min-width: 48rem) 30vw, 50vw"
              className="absolute inset-0 size-full"
            />
          }
          {...(hideArtist
            ? {}
            : {
                subtitle: (
                  <Link
                    href={`/artists/${card.artistSlug}`}
                    className="shop-focus-ring rounded-sm hover:text-on-surface hover:underline"
                  >
                    {card.artistName}
                  </Link>
                ),
              })}
          {...(card.editionLine ? { footerNote: <p>{card.editionLine}</p> } : {})}
          {...(card.priceLine
            ? {
                // The card's one status: the price, or "Sold out" in its place.
                footer: (
                  <p
                    className={
                      card.soldOut ? "font-normal text-on-surface-variant" : "tabular-nums"
                    }
                  >
                    {card.priceLine}
                  </p>
                ),
              }
            : {})}
        />
      ))}
    </MarketingWorkGrid>
  );
}
