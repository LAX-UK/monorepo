import { MarketingLinkCard } from "@/components/marketing/marketing-link-card";
import { SaleCardEditorial } from "@/components/marketing/sale-card-editorial";
import { SALE_CARD_SHELL_CLASSNAME } from "@/components/sections/sales/card/sale-card-shell";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type { SaleCardEditorialProps } from "@/components/marketing/sale-card-editorial";

export type SaleCardGridProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

/** Calendar / featured grid tile — composes `SaleCardMedia` + meta in `children`. */
export function SaleCardGrid({ href, children, className }: SaleCardGridProps) {
  return (
    <MarketingLinkCard
      href={href}
      className={cn(SALE_CARD_SHELL_CLASSNAME, "flex h-full min-h-0 flex-col gap-3", className)}
    >
      {children}
    </MarketingLinkCard>
  );
}

export type SaleCardListProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

/** List / calendar row — horizontal media + body in `children`. */
export function SaleCardList({ href, children, className }: SaleCardListProps) {
  return (
    <MarketingLinkCard
      href={href}
      className={cn(
        "flex flex-col gap-4 rounded-lg bg-page-bg p-3 outline outline-1 -outline-offset-1 outline-outline-variant/60 sm:flex-row sm:items-stretch sm:gap-6 sm:p-5 lg:p-6 dark:bg-surface-container-low",
        className,
      )}
    >
      {children}
    </MarketingLinkCard>
  );
}

export const SaleCard = {
  Grid: SaleCardGrid,
  List: SaleCardList,
  Editorial: SaleCardEditorial,
} as const;
