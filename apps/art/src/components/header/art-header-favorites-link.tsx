"use client";

import { FOCUS_RING } from "@auction/branding";
import {
  MARKETING_HEADER_CHROME,
  type MarketingHeaderTone,
  MarketingHeartIcon,
  headerChromeIconClass,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

export function ArtHeaderFavoritesLink({ headerTone }: { headerTone: MarketingHeaderTone }) {
  return (
    <Link
      href="/account/favourites"
      aria-label="Saved favourites"
      className={cn(
        MARKETING_HEADER_CHROME,
        "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm",
        headerChromeIconClass(headerTone),
        FOCUS_RING,
      )}
    >
      <MarketingHeartIcon className="size-5" aria-hidden />
    </Link>
  );
}
