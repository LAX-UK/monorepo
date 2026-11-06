import { isNewPerson, loadHomePortfolio } from "@/server/application/load-home-portfolio";
import type { AccountProductVm } from "@/server/domain/account-products.vm";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import { buildCollection } from "@/server/domain/collection.vm";
import { buildNeedsYou } from "@/server/domain/home-needs-you.vm";
import { unansweredProducts } from "@/server/domain/home-products-status";
import { buildAttentionRows } from "@/server/domain/portfolio-attention.vm";
import type { ComposedRows } from "@/server/domain/portfolio-composition";
import { PORTFOLIO_ROUTES } from "@/server/domain/portfolio-routes";
import { buildWorksByProduct } from "@/server/domain/works-by-product.vm";
import { type LaxPortfolioItemV1, buildPortfolioHeader } from "@auction/lax-ecosystem";
import { CARD } from "./account-ui";
import { CollectionCard, CollectionCardSkeleton } from "./collection-card";
import { NeedsYouCard, NeedsYouCardSkeleton } from "./home-needs-you-card";
import { HomeNewPerson } from "./home-new-person";
import { ProductCards } from "./product-cards";

const INCOMPLETE_NOTE = "Some products did not answer, so these figures may be low.";

/** The cards' grid: what needs you gets the wider column, the collection sits beside it. */
function CardsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-5 lg:gap-6 [&>:first-child]:lg:col-span-3 [&>:last-child]:lg:col-span-2">
      {children}
    </div>
  );
}

/** Shown while the products answer: the final shape of each card, and the products by name. */
export function HomePortfolioSkeleton({ products }: { products: AccountProductVm[] }) {
  return (
    <>
      <CardsGrid>
        <NeedsYouCardSkeleton />
        <CollectionCardSkeleton />
      </CardsGrid>
      <ProductCards products={products} />
    </>
  );
}

function Works({
  composed,
  products,
}: {
  composed: ComposedRows<LaxPortfolioItemV1>;
  products: AccountProductVm[];
}) {
  const unanswered = unansweredProducts(composed.unavailable);
  const header = buildPortfolioHeader(composed.rows);
  return (
    <>
      <CardsGrid>
        <NeedsYouCard needsYou={buildNeedsYou(buildAttentionRows(composed.rows))} />
        <CollectionCard
          collection={buildCollection(header, composed.rows.length)}
          chart={buildWorksByProduct(composed.rows, unanswered)}
          incompleteNote={composed.complete ? null : INCOMPLETE_NOTE}
          link={{ href: PORTFOLIO_ROUTES.overview, label: "View portfolio" }}
        />
      </CardsGrid>
      <ProductCards
        products={products}
        unanswered={unanswered}
        retryHref={ACCOUNT_ROUTES.overview}
      />
    </>
  );
}

/**
 * Needs you, Your collection and the products, read from the products on their own so the
 * greeting and the checkup are not held up. Someone with no works is invited to start; if the
 * products cannot be read at all, nothing is invented and each product says so.
 */
export async function HomePortfolioSection({ products }: { products: AccountProductVm[] }) {
  const loaded = await loadHomePortfolio();
  if (isNewPerson(loaded)) {
    return <HomeNewPerson products={products} />;
  }
  if (loaded.status === "ok" && loaded.rows.length > 0) {
    return <Works composed={loaded} products={products} />;
  }
  // Nothing could be read: show the products, each with a way to try again.
  const unanswered =
    loaded.status === "ok"
      ? unansweredProducts(loaded.unavailable)
      : products.map((product) => product.id);
  return (
    <>
      <p className={`${CARD} px-4 py-4 text-sm text-on-surface-variant sm:px-5`}>
        We can't show your works right now. Please try again in a moment.
      </p>
      <ProductCards
        products={products}
        unanswered={unanswered}
        retryHref={ACCOUNT_ROUTES.overview}
      />
    </>
  );
}
