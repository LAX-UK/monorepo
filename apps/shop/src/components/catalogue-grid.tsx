import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { buildCatalogueArtworkCards } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingCardMedia, MarketingCardShell } from "@auction/marketing-ui";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

type CatalogueGridProps = {
  items: PublicArtworkSummary[];
};

export function CatalogueGrid({ items }: CatalogueGridProps) {
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
    <ul className="shop-catalogue__list">
      {cards.map((card) => (
        <li key={card.slug}>
          <MarketingCardShell interactive className="shop-catalogue__card">
            <MarketingCardMedia className="shop-catalogue__media">
              <ShopMediaImage
                src={card.imageUrl}
                alt={card.imageAlt}
                label={SHOP_MEDIA_LABELS.artwork}
                aspect={[4, 5]}
                sizes="(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw"
                className="absolute inset-0 size-full"
              />
            </MarketingCardMedia>
            <div className="shop-catalogue__body">
              <h3 className="shop-catalogue__title">
                <Link href={card.href}>{card.title}</Link>
              </h3>
              {card.status ? (
                <div className="shop-catalogue__status">
                  <DotStatusPill label={card.status.label} tone={card.status.tone} />
                </div>
              ) : null}
              <p className="shop-catalogue__artist">{card.artistName}</p>
              {card.dimensions ? (
                <p className="shop-catalogue__dimensions">{card.dimensions}</p>
              ) : null}
              <p className="shop-catalogue__meta">{card.metaLine}</p>
            </div>
          </MarketingCardShell>
        </li>
      ))}
    </ul>
  );
}
