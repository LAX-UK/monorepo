import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import type { HomeHeroVm } from "@/lib/home/home-page.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingReturnIcon, MarketingTruckIcon } from "@auction/marketing-ui";
import Link from "next/link";

/**
 * The first screen: what Shop sells, one action to the catalogue, and a real edition on sale now,
 * shown whole on a mat like every other work in the Shop.
 */
export function HomeHero({ hero }: { hero: HomeHeroVm }) {
  return (
    <section className="shop-home-hero" aria-labelledby="home-hero-heading">
      <div className="shop-home-hero__copy">
        <h1 id="home-hero-heading" className="shop-home-hero__title">
          {hero.title}
        </h1>
        <p className="shop-home-hero__lead">{hero.lead}</p>
        <div className="shop-home-hero__actions">
          <ShopCommerceButton href={hero.primary.href}>{hero.primary.label}</ShopCommerceButton>
          <ShopCommerceButton href={hero.secondary.href} variant="outline" scale="commerce">
            {hero.secondary.label}
          </ShopCommerceButton>
        </div>
        <ul className="shop-home-hero__facts">
          <li>
            <MarketingTruckIcon className="shop-home-hero__fact-icon" />
            {hero.deliveryLine}
          </li>
          <li>
            <MarketingReturnIcon className="shop-home-hero__fact-icon" />
            {hero.returnsLine}
          </li>
        </ul>
      </div>
      {hero.feature ? (
        <figure className="shop-home-hero__feature">
          <Link href={hero.feature.href} className="shop-home-hero__mat" tabIndex={-1} aria-hidden>
            <span className="shop-home-hero__frame">
              <ShopMediaImage
                src={hero.feature.imageUrl}
                alt=""
                label={SHOP_MEDIA_LABELS.artwork}
                sizes="(min-width: 64rem) 40vw, 90vw"
                priority
                className="absolute inset-0 size-full"
                imgClassName="object-contain"
              />
            </span>
          </Link>
          <figcaption className="shop-home-hero__caption">
            <Link
              href={hero.feature.href}
              className="shop-home-hero__caption-title shop-focus-ring"
            >
              {hero.feature.title}
            </Link>
            <span className="shop-home-hero__caption-meta">
              {hero.feature.artistName}
              {hero.feature.editionLine ? ` · ${hero.feature.editionLine}` : null}
            </span>
            {hero.feature.priceLine ? (
              <span className="shop-home-hero__caption-price">{hero.feature.priceLine}</span>
            ) : null}
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
