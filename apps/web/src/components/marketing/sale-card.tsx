import { MarketingLinkCard } from "@/components/marketing/marketing-link-card";
import { SALE_CARD_SHELL_CLASSNAME } from "@/components/sections/sales/card/sale-card-shell";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

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

export type SaleCardEditorialProps = {
  href: string;
  /** `bold`: scrim + title on image. `calm`: caption block below `16/9` media. */
  tone: "bold" | "calm";
  image: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
};

/** `16/9` sale editorial — sale imagery uses **cover** (commissioned art). */
export function SaleCardEditorial({
  href,
  tone,
  image,
  title,
  subtitle,
  className,
}: SaleCardEditorialProps) {
  if (tone === "calm") {
    return (
      <MarketingLinkCard
        href={href}
        className={cn(
          "block overflow-hidden rounded-xl border border-outline-variant/15 bg-surface shadow-sm",
          className,
        )}
      >
        <div className="relative aspect-video bg-surface-container-low">{image}</div>
        <div className="p-6">
          {title}
          {subtitle}
        </div>
      </MarketingLinkCard>
    );
  }

  return (
    <MarketingLinkCard
      href={href}
      className={cn("relative block overflow-hidden rounded-xl shadow-sm", className)}
    >
      <div className="relative aspect-video bg-surface-container-low">
        <div className="absolute inset-0 [&_img]:size-full [&_img]:object-cover">{image}</div>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 z-[1] space-y-2 p-6 text-white">
          {title}
          {subtitle}
        </div>
      </div>
    </MarketingLinkCard>
  );
}

export const SaleCard = {
  Grid: SaleCardGrid,
  List: SaleCardList,
  Editorial: SaleCardEditorial,
} as const;
