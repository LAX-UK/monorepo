import { ShopMediaImage } from "@/components/media/shop-media-image";
import { buildCatalogueArtworkCards } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingCatalogList, MarketingCatalogListRow } from "@auction/marketing-ui";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

type CatalogueListProps = {
  items: PublicArtworkSummary[];
};

/** List layout for the Shop catalogue — Bid's list row with Shop's card content. */
export function CatalogueList({ items }: CatalogueListProps) {
  const cards = buildCatalogueArtworkCards(items);
  return (
    <MarketingCatalogList data-testid="shop-catalogue-list">
      {cards.map((card) => (
        <MarketingCatalogListRow
          key={card.slug}
          href={card.href}
          linkLabel={`${card.title} by ${card.artistName}`}
          image={
            <ShopMediaImage
              src={card.imageUrl}
              alt=""
              label={SHOP_MEDIA_LABELS.artwork}
              sizes="96px"
              className="absolute inset-0 size-full"
            />
          }
          title={card.title}
          subtitle={
            <div className="flex flex-col gap-0.5">
              <Link
                href={`/artists/${card.artistSlug}`}
                className="shop-focus-ring w-fit rounded-sm hover:text-on-surface"
              >
                {card.artistName}
              </Link>
              {card.dimensions ? <p className="line-clamp-1">{card.dimensions}</p> : null}
            </div>
          }
          trailing={
            card.status ? <DotStatusPill label={card.status.label} tone={card.status.tone} /> : null
          }
          footer={<p className="text-sm text-on-surface">{card.metaLine}</p>}
        />
      ))}
    </MarketingCatalogList>
  );
}
