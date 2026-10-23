import type { AccountProductVm } from "@/server/domain/account-products.vm";
import { Button } from "@auction/ui/components/button";
import { PRODUCT_LOCKUPS } from "./product-lockups";

/**
 * One account, every LAX product, each shown by its own lockup (which keeps the product's own
 * colours). Cards link out only; they make no claim about past use.
 */
export function ProductCards({ products }: { products: AccountProductVm[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="your-products-heading" className="flex flex-col gap-4">
      <h2 id="your-products-heading" className="font-headline text-xl font-semibold">
        Your LAX products
      </h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {products.map((product) => {
          const lockup = PRODUCT_LOCKUPS[product.id];
          return (
            <li
              key={product.id}
              className="flex flex-col gap-5 rounded-2xl border border-border-hairline bg-surface p-5"
            >
              <div className="flex h-12 items-center">
                {/* Only one of the pair is displayed, so assistive technology reads the name once. */}
                <img src={lockup.light} alt={product.name} className="h-11 w-auto dark:hidden" />
                <img
                  src={lockup.dark}
                  alt={product.name}
                  className="hidden h-11 w-auto dark:block"
                />
              </div>
              <p className="text-sm text-on-surface-variant">{product.tagline}</p>
              <Button asChild variant="outline" size="sm" className="mt-auto min-h-11 self-start">
                <a href={product.href} aria-label={`Open ${product.name}`}>
                  Open
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
