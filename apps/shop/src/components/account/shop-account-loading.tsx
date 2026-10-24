import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";

const ROWS = ["a", "b", "c", "d"] as const;

function Bar({ className }: { className: string }) {
  return <span className={cn("shop-skeleton__bar", className)} />;
}

/** Account page skeleton: header, then order rows (list) or items and summary (detail). */
export function ShopAccountLoading({ variant }: { variant: "list" | "detail" }) {
  return (
    <main
      id="main-content"
      className={cn(MARKETING_CATALOG_PT, "bg-page-bg pb-[var(--page-bottom-padding,3rem)]")}
    >
      <div className={cn(MARKETING_PAGE_SHELL, "shop-page py-8 lg:py-12")}>
        <div className="shop-account" aria-busy="true">
          <output className="sr-only">Loading</output>
          <div className="shop-account__header">
            <div className="flex flex-col gap-3">
              <Bar className="shop-account-skeleton__crumb" />
              <Bar className="shop-skeleton__bar--title" />
            </div>
          </div>
          {variant === "list" ? (
            <ul className="shop-account-skeleton__rows">
              {ROWS.map((key) => (
                <li key={key} className="shop-account-skeleton__row">
                  <Bar className="shop-account-skeleton__thumb" />
                  <Bar className="shop-account-skeleton__text" />
                  <Bar className="shop-account-skeleton__pill" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="shop-order-detail">
              <div className="shop-order-detail__items">
                <div className="shop-account-skeleton__row">
                  <Bar className="shop-account-skeleton__thumb" />
                  <Bar className="shop-account-skeleton__text" />
                </div>
              </div>
              <div className="shop-order-detail__summary">
                <Bar className="shop-account-skeleton__pill" />
                <Bar className="shop-account-skeleton__text" />
                <Bar className="shop-account-skeleton__text" />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
