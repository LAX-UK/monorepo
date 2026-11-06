"use client";

import { shopBasketAccessibleLabel } from "@/components/header/shop-basket-accessible-label";
import { FOCUS_RING } from "@auction/branding";
import {
  MARKETING_COUNT_BADGE_CLASS,
  MarketingBagIcon,
  type MarketingHeaderTone,
  headerChromeIconClass,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

const BASKET_HREF = "/basket";

type ShopHeaderBasketLinkProps = {
  itemCount: number;
  headerTone?: MarketingHeaderTone;
  className?: string;
  onNavigate?: () => void;
};

export function ShopHeaderBasketLink({
  itemCount,
  headerTone = "on-light",
  className,
  onNavigate,
}: ShopHeaderBasketLinkProps) {
  const safeCount = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0;
  const showBadge = safeCount > 0;

  return (
    <Link
      href={BASKET_HREF}
      aria-label={shopBasketAccessibleLabel(safeCount)}
      className={cn(
        "relative inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md",
        FOCUS_RING,
        headerChromeIconClass(headerTone),
        className,
      )}
      {...(onNavigate ? { onClick: onNavigate } : {})}
    >
      <MarketingBagIcon className="size-5" />
      {showBadge ? (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 font-label text-xs font-semibold leading-none",
            MARKETING_COUNT_BADGE_CLASS,
          )}
          aria-hidden
        >
          {safeCount > 99 ? "99+" : safeCount}
        </span>
      ) : null}
    </Link>
  );
}
