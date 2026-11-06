import { Button } from "@/components/account-button";
import type { AccountProductId, AccountProductVm } from "@/server/domain/account-products.vm";
import { MarketingViewAllChevron } from "@auction/marketing-ui";
import { CARD, SECTION_TITLE } from "./account-ui";
import { PRODUCT_LOCKUPS } from "./product-lockups";

/**
 * One account, every LAX product in family order, each shown by its own lockup (which keeps the
 * product's own colours) with a button that names it. On a phone a card is one row with a
 * chevron and the whole row opens the product. Cards link out only; they make no claim about
 * past use. `unanswered` names the products whose works could not be read, with a way to retry.
 */
export function ProductCards({
  products,
  unanswered = [],
  retryHref,
}: {
  products: AccountProductVm[];
  unanswered?: readonly AccountProductId[];
  retryHref?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="your-products-heading" className="flex flex-col gap-4">
      <h2 id="your-products-heading" className={SECTION_TITLE}>
        Your LAX products
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {products.map((product) => {
          const lockup = PRODUCT_LOCKUPS[product.id];
          return (
            <li
              key={product.id}
              className={`relative flex flex-wrap items-center gap-x-3 gap-y-2 p-4 transition-colors max-sm:min-h-16 max-sm:hover:bg-surface-container-low max-sm:active:bg-surface-container sm:flex-col sm:items-stretch sm:gap-4 sm:p-6 ${CARD}`}
            >
              <div className="flex h-9 items-center">
                {/* Only one of the pair is displayed, so assistive technology reads the name once. */}
                <img src={lockup.light} alt={product.name} className="h-8 w-auto dark:hidden" />
                <img
                  src={lockup.dark}
                  alt={product.name}
                  className="hidden h-8 w-auto dark:block"
                />
              </div>
              <p className="min-w-0 flex-1 truncate text-sm text-on-surface-variant sm:flex-none sm:whitespace-normal">
                {product.tagline}
              </p>
              <MarketingViewAllChevron className="size-4 text-on-surface-variant sm:hidden" />
              <Button
                asChild
                variant="outline"
                className="mt-auto self-start max-sm:absolute max-sm:inset-0 max-sm:min-h-0 max-sm:rounded-2xl max-sm:border-transparent max-sm:bg-transparent max-sm:text-transparent max-sm:hover:bg-transparent max-sm:focus-visible:ring-inset max-sm:focus-visible:ring-offset-0"
              >
                <a href={product.href} aria-label={`Open ${product.name}`}>
                  {`Open ${product.name}`}
                </a>
              </Button>
              {unanswered.includes(product.id) ? (
                <p className="relative z-10 text-xs text-on-surface-variant max-sm:basis-full">
                  {`We couldn't load ${product.name} just now. `}
                  <a
                    href={retryHref ?? "#"}
                    className="font-medium text-on-surface underline underline-offset-[3px]"
                  >
                    Try again
                  </a>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
