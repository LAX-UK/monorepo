import { CatalogueList } from "@/components/catalogue-list";
import { ShopEditionCard } from "@/components/catalogue/shop-edition-card";
import { ShopEditionFeature } from "@/components/catalogue/shop-edition-feature";
import { shopButtonClassName } from "@/components/shop-commerce-button";
import { editionsLabel } from "@/lib/catalogue/catalogue-count-line";
import type { CatalogueResultsVm } from "@/lib/catalogue/catalogue-page.composer";
import { buildEditionCards } from "@/lib/catalogue/edition-card.vm";
import {
  type CatalogLayoutView,
  MarketingCardRow,
  MarketingCatalogView,
} from "@auction/marketing-ui";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

/** Cards above the fold load their image first. */
const PRIORITY_CARDS = 3;

const GRID_SIZES =
  "(min-width: 100rem) 20vw, (min-width: 80rem) 24vw, (min-width: 64rem) 34vw, 50vw";
const PAIR_SIZES = "(min-width: 64rem) 22vw, (min-width: 40rem) 45vw, 90vw";

/**
 * Editions laid out for their count, by the shared row rule: one is a feature, two a pair of
 * side-by-side cards, three or more the grid (two columns on phones, three beside the rail from
 * 1280 px, four from 1600 px). Sold-out cards say so in place of the price.
 */
export function CatalogueResultsRow({
  items,
  titleAs = "h2",
  now = new Date(),
}: {
  items: readonly PublicArtworkSummary[];
  /** h2 when the cards are the page's results, h3 inside a titled section. */
  titleAs?: "h2" | "h3";
  now?: Date;
}) {
  const cards = buildEditionCards(items, now);
  return (
    <MarketingCardRow
      aria-label="Editions"
      items={cards}
      getKey={(card) => card.slug}
      className={cards.length >= 3 ? "shop-catalogue-grid" : "shop-catalogue-row"}
      renderItem={(card, layout, index) =>
        layout === "feature" ? (
          <ShopEditionFeature card={card} headingLevel={titleAs} priority />
        ) : (
          <ShopEditionCard
            card={card}
            titleAs={titleAs}
            layout={layout === "pair" ? "side" : "stacked"}
            sizes={layout === "pair" ? PAIR_SIZES : GRID_SIZES}
            priority={index < PRIORITY_CARDS}
          />
        )
      }
    />
  );
}

/** The catalogue's results in the shopper's chosen view, then "Load more" past a page. */
export function CatalogueResults({
  results,
  view,
}: {
  results: CatalogueResultsVm;
  view: CatalogLayoutView;
}) {
  return (
    <div className="shop-catalogue-results">
      <MarketingCatalogView
        value={view}
        grid={<CatalogueResultsRow items={results.items} />}
        list={<CatalogueList items={[...results.items]} />}
      />
      {results.loadMoreHref ? (
        <nav aria-label="More editions" className="shop-catalogue-more">
          <p className="shop-catalogue-more__status">
            {`Showing ${results.items.length} of ${editionsLabel(results.total)}`}
          </p>
          {/* The list grows in place, so the page keeps its scroll position. */}
          <Button asChild variant="outline" className={shopButtonClassName("outline", "standard")}>
            <Link href={results.loadMoreHref} scroll={false}>
              Load more
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
