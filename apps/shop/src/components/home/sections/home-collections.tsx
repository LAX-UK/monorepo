import { ShopSection } from "@/components/layout/shop-section";
import { ShopMediaImage } from "@/components/media/shop-media-image";
import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import type { HomeCollectionVm } from "@/lib/home/home-browse-paths";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import Link from "next/link";

function CollectionTile({ tile }: { tile: HomeCollectionVm }) {
  return (
    <li className="shop-collection">
      <div className="shop-collection__mat" aria-hidden="true">
        {tile.covers.map((cover) => (
          <span key={cover.slug} className="shop-collection__print">
            <ShopMediaImage
              src={cover.imageUrl}
              alt=""
              label={SHOP_MEDIA_LABELS.artwork}
              sizes="(min-width: 64rem) 14vw, 40vw"
              className="absolute inset-0 size-full"
              imgClassName="object-contain"
            />
          </span>
        ))}
      </div>
      <h3 className="shop-collection__title">
        <Link href={tile.href} className="shop-collection__link">
          {tile.title}
        </Link>
      </h3>
      <p className="shop-collection__count">{tile.countLabel}</p>
    </li>
  );
}

export function HomeCollectionsSection({
  collections,
}: { collections: readonly HomeCollectionVm[] }) {
  if (collections.length === 0) return null;
  const copy = SHOP_HOME_CONTENT.collections;
  return (
    <ShopSection id="home-collections" title={copy.title} subtitle={copy.subtitle}>
      <ul className="shop-collections" data-count={collections.length}>
        {collections.map((tile) => (
          <CollectionTile key={tile.key} tile={tile} />
        ))}
      </ul>
    </ShopSection>
  );
}
