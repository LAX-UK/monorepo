import type { AccountProductVm } from "@/server/domain/account-products.vm";
import { PRODUCT_LOCKUPS } from "./product-lockups";

/**
 * The three products one account opens, shown as their own lockups on the sign-in panel. The
 * lockups keep each product's colours. Only one of each light and dark pair is displayed, so a
 * screen reader hears the name once.
 */
export function SignInProducts({ products }: { products: AccountProductVm[] }) {
  if (products.length === 0) return null;
  return (
    <section
      aria-labelledby="sign-in-products-heading"
      className="flex max-w-lg flex-col gap-4 border-t border-border-hairline pt-6"
    >
      <h2 id="sign-in-products-heading" className="text-sm font-medium text-on-surface-variant">
        One sign-in for
      </h2>
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 sm:gap-x-8">
        {products.map((product) => {
          const lockup = PRODUCT_LOCKUPS[product.id];
          return (
            <li key={product.id}>
              <a
                href={product.href}
                className="flex min-h-11 items-center rounded-sm"
                aria-label={product.name}
              >
                <img src={lockup.light} alt="" className="h-6 w-auto sm:h-7 dark:hidden" />
                <img src={lockup.dark} alt="" className="hidden h-6 w-auto sm:h-7 dark:block" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
