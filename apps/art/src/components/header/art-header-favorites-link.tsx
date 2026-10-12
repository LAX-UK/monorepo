"use client";

import { FOCUS_RING } from "@auction/branding";
import {
  MARKETING_HEADER_CHROME,
  MarketingHeartIcon,
  headerChromeIconClass,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

export function ArtHeaderFavoritesLink() {
  return (
    <Link
      href="/account/favorites"
      aria-label="Saved favorites"
      className={cn(
        MARKETING_HEADER_CHROME,
        "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm",
        headerChromeIconClass("on-light"),
        FOCUS_RING,
      )}
    >
      <MarketingHeartIcon className="size-5" aria-hidden />
    </Link>
  );
}
