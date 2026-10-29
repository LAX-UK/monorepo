import { ShopEditionCard } from "@/components/catalogue/shop-edition-card";
import { ShopEditionFeature } from "@/components/catalogue/shop-edition-feature";
import { ShopCatalogueState } from "@/components/home/shop-empty-state";
import { ShopSection } from "@/components/layout/shop-section";
import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import { toEditionCardVm } from "@/lib/catalogue/edition-card.vm";
import type { HomeNewEditionsVm } from "@/lib/home/home-new-editions";
import { MARKETING_ROW_MAX_COLUMNS, MarketingCardRow } from "@auction/marketing-ui";

const copy = SHOP_HOME_CONTENT.newEditions;

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
              <ShopEditionFeature card={card} />
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
