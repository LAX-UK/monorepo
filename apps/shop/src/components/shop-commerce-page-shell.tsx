import { ShopPageHeader, type ShopPageHeaderProps } from "@/components/shop-page-header";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type ShopCommercePageShellProps = {
  header: ShopPageHeaderProps;
  /** e.g. shop-basket, shop-checkout, shop-orders */
  contentClassName?: string;
  children: ReactNode;
};

/** Wide page header at the gutter; narrow centered commerce body below (Bid-aligned). */
export function ShopCommercePageShell({
  header,
  contentClassName,
  children,
}: ShopCommercePageShellProps) {
  return (
    <div className="shop-commerce-page" data-testid="shop-commerce-page">
      <ShopPageHeader {...header} />
      <div
        className={cn("shop-commerce-content", contentClassName)}
        data-testid="shop-commerce-content"
      >
        {children}
      </div>
    </div>
  );
}
