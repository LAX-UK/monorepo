import type { ProductBarItemVm } from "@/server/domain/account-nav.vm";
import { cn } from "@auction/ui";

/**
 * The bar is one 16px line, so each link's hit area is widened to 44px tall with an invisible
 * box around it instead of padding that would make the bar taller.
 */
const LABEL =
  "relative font-label text-xs uppercase tracking-[0.22em] after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-['']";

/**
 * LAX BID · LAX ART · LAX SHOP · LAX ACCOUNT: the small bar every LAX header carries so a person
 * can move between products. The current product is the only one in full text colour and is not
 * a link. The bar is hidden on a phone, where the menu sheet lists the products instead.
 */
export function ProductBar({
  items,
  className,
}: { items: ProductBarItemVm[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="LAX products" className={cn("flex flex-wrap items-center gap-6", className)}>
      {items.map((item) =>
        item.current ? (
          <a
            key={item.id}
            href={item.href}
            aria-current="page"
            className={cn(LABEL, "rounded-sm text-on-surface")}
          >
            {item.label}
          </a>
        ) : (
          <a
            key={item.id}
            href={item.href}
            rel="noopener noreferrer"
            className={cn(
              LABEL,
              "rounded-sm text-on-surface-variant transition-colors hover:text-on-surface",
            )}
          >
            {item.label}
          </a>
        ),
      )}
    </nav>
  );
}
