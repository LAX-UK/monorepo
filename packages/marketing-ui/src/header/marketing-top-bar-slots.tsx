import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingTopBarSlotsProps = {
  /** The underlined 240px search field; shown from 1280px. */
  searchField: ReactNode;
  /** The search icon button; shown from 768px up to 1279px. */
  searchIcon: ReactNode;
  /** The product action (Shop basket, lax.art favourites). Omit when the product has none. */
  productAction?: ReactNode;
  account: ReactNode;
  /** The menu button; the only control besides the lockup below 768px. */
  menuButton: ReactNode;
  className?: string;
};

/**
 * The right-hand side of the main header row. Below 768px only the menu button shows (the
 * lockup sits at the left; search, account and the product action live in the bottom bar). From
 * 768px: search, product action, account, then the menu button. Search is an underlined 240px
 * field from 1280px and an icon below that.
 */
export function MarketingTopBarSlots({
  searchField,
  searchIcon,
  productAction,
  account,
  menuButton,
  className,
}: MarketingTopBarSlotsProps) {
  return (
    <div data-testid="top-bar-slots" className={cn("flex items-center gap-1 md:gap-3", className)}>
      <div data-slot="search-field" className="hidden w-60 xl:block">
        {searchField}
      </div>
      <div data-slot="search-icon" className="hidden md:block xl:hidden">
        {searchIcon}
      </div>
      {productAction ? (
        <div data-slot="product-action" className="hidden md:block">
          {productAction}
        </div>
      ) : null}
      <div data-slot="account" className="hidden md:block">
        {account}
      </div>
      <div data-slot="menu">{menuButton}</div>
    </div>
  );
}
