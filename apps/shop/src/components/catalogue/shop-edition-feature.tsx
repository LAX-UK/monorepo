import { ShopWorkMat } from "@/components/media/shop-work-mat";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import type { EditionCardVm } from "@/lib/catalogue/edition-card.vm";
import { MarketingBellIcon, MarketingSplitFeature } from "@auction/marketing-ui";
import Link from "next/link";

const SEE_LABEL = "See the edition";

export type ShopEditionFeatureProps = {
  card: EditionCardVm;
  /** h2 when the feature is a page's only result, h3 inside a titled section. */
  headingLevel?: "h2" | "h3";
  priority?: boolean;
};

/**
 * A single edition, told large: the work on its mat beside its title, artist, facts and price
 * (or "Sold out" and "Get alerts"). Used wherever a list holds just one edition, so one work
 * never sits alone in a grid built for many.
 */
export function ShopEditionFeature({
  card,
  headingLevel = "h3",
  priority = false,
}: ShopEditionFeatureProps) {
  const status = card.status;
  return (
    <MarketingSplitFeature
      className="shop-home-feature"
      tone="plain"
      headingLevel={headingLevel}
      mediaSide="left"
      eyebrow={
        status?.kind === "new" ? <span className="shop-home-eyebrow">{status.label}</span> : null
      }
      title={card.title}
      media={
        <Link
          href={card.href}
          className="shop-home-feature__media"
          tabIndex={-1}
          aria-hidden="true"
        >
          <ShopWorkMat
            src={card.imageUrl}
            alt={card.imageAlt}
            sizes="(min-width: 48rem) 40vw, 90vw"
            priority={priority}
            className="shop-home-feature__mat"
          />
        </Link>
      }
      body={
        <div className="shop-home-feature__caption">
          <Link href={card.artistHref} className="shop-inline-link shop-focus-ring">
            {card.artistName}
          </Link>
          {card.factsLine ? <p className="shop-home-feature__facts">{card.factsLine}</p> : null}
          {status?.kind === "sold_out" ? (
            <p className="shop-edition-card__sold">
              <span>{status.label}</span>
              <Link
                href={status.alertHref}
                className="shop-edition-card__alert shop-focus-ring"
                aria-label={`${status.alertLabel} for ${card.title}`}
              >
                <MarketingBellIcon className="shop-edition-card__alert-icon" />
                {status.alertLabel}
              </Link>
            </p>
          ) : card.priceLabel ? (
            <p className="shop-home-feature__price">{card.priceLabel}</p>
          ) : null}
        </div>
      }
      action={
        <ShopCommerceButton href={card.href} variant="outline" scale="standard">
          {SEE_LABEL}
          <span className="sr-only">{`, ${card.title}`}</span>
        </ShopCommerceButton>
      }
    />
  );
}
