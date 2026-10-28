import { ShopEditionCard } from "@/components/catalogue/shop-edition-card";
import { ShopCatalogueState } from "@/components/home/shop-empty-state";
import { ShopSection } from "@/components/layout/shop-section";
import { ShopWorkMat } from "@/components/media/shop-work-mat";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import { type EditionCardVm, toEditionCardVm } from "@/lib/catalogue/edition-card.vm";
import type { HomeNewEditionsVm } from "@/lib/home/home-new-editions";
import {
  MARKETING_ROW_MAX_COLUMNS,
  MarketingCardRow,
  MarketingSplitFeature,
} from "@auction/marketing-ui";
import Link from "next/link";

const copy = SHOP_HOME_CONTENT.newEditions;

/** A single new edition, told large: the work on its mat beside its caption. */
function NewEditionFeature({ card }: { card: EditionCardVm }) {
  return (
    <MarketingSplitFeature
      className="shop-home-feature"
      tone="plain"
      headingLevel="h3"
      mediaSide="left"
      eyebrow={
        card.status?.kind === "new" ? (
          <span className="shop-home-eyebrow">{card.status.label}</span>
        ) : null
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
          {card.priceLabel ? <p className="shop-home-feature__price">{card.priceLabel}</p> : null}
        </div>
      }
      action={
        <ShopCommerceButton href={card.href} variant="outline" scale="standard">
          {copy.seeLabel}
          <span className="sr-only">{`, ${card.title}`}</span>
        </ShopCommerceButton>
      }
    />
  );
}

/**
 * "New editions" after the first screen's release, laid out for its count by the shared row
 * rule: a feature for one, a pair of side-by-side cards for two, a row of three or four. It never
 * starts a second row; "View all" leads to every edition on sale.
 */
export function NewEditionsSection({
  editions,
  errorMessage,
  now,
}: {
  editions: HomeNewEditionsVm | null;
  errorMessage?: string | undefined;
  now: Date;
}) {
  if (!editions && !errorMessage) return null;
  return (
    <ShopSection
      id="home-editions"
      title={copy.title}
      subtitle={copy.subtitle}
      {...(editions ? { viewAll: { ...editions.viewAll, srLabel: "on sale" } } : {})}
    >
      {editions ? (
        <MarketingCardRow
          aria-label={copy.title}
          items={editions.items.map((item) => toEditionCardVm(item, now))}
          getKey={(card) => card.slug}
          max={MARKETING_ROW_MAX_COLUMNS}
          className="shop-home-editions"
          renderItem={(card, layout) =>
            layout === "feature" ? (
              <NewEditionFeature card={card} />
            ) : (
              <ShopEditionCard
                card={card}
                titleAs="h3"
                layout={layout === "pair" ? "side" : "stacked"}
                sizes={
                  layout === "pair"
                    ? "(min-width: 48rem) 25vw, 50vw"
                    : "(min-width: 64rem) 22vw, (min-width: 40rem) 45vw, 90vw"
                }
              />
            )
          }
        />
      ) : (
        <ShopCatalogueState
          variant="error"
          title="New editions are unavailable right now"
          description="We could not load the newest editions. Try again, or browse the catalogue."
          browseHref="/artworks"
          browseLabel="Browse editions"
        />
      )}
    </ShopSection>
  );
}
