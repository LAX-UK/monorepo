import type { ProductBarItemVm } from "@/server/domain/account-nav.vm";
import { cn } from "@auction/ui";

const LABEL = "font-label text-xs uppercase tracking-[0.22em]";

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
