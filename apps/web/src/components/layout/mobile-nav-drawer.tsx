"use client";

import { MobileAuthSection } from "@/components/layout/header-auth-chip";
import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { megaMenuSectionActive, utilityNav } from "@/components/layout/header-nav-config";
import { HeaderSearchPaletteTrigger } from "@/components/layout/header-search";
import { LaxLogo } from "@/components/layout/lax-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { linkIsCurrent } from "@/lib/nav/is-current";
import { MarketingMobileNavDrawer } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

type MobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  searchParams: Pick<URLSearchParams, "get"> | null;
  sections: MegaMenuSection[];
};

export function MobileNavDrawer({
  open,
  onOpenChange,
  pathname,
  searchParams,
  sections,
}: MobileNavDrawerProps) {
  const searchKey = searchParams == null ? "" : searchParams.toString();
  const resetKey = `${pathname}:${searchKey}`;

  return (
    <MarketingMobileNavDrawer
      open={open}
      onOpenChange={onOpenChange}
      resetKey={resetKey}
      sections={sections}
      isSectionActive={(section) => megaMenuSectionActive(pathname, section, searchParams)}
      isLinkCurrent={(href) => linkIsCurrent(pathname, href)}
      utilityLinks={utilityNav}
      logo={
        <Link
          href="/"
          className={cn("shrink-0 rounded-sm", FOCUS_RING)}
          onClick={() => onOpenChange(false)}
        >
          <LaxLogo variant="header" imageWidth={1089} imageHeight={331} />
        </Link>
      }
      topSlot={<HeaderSearchPaletteTrigger variant="drawer" onOpen={() => onOpenChange(false)} />}
      themeSlot={
        <>
          <span className="font-label text-xs font-semibold uppercase text-brand-400 dark:text-on-surface-variant">
            Theme
          </span>
          <ThemeToggle />
        </>
      }
      footerSlot={<MobileAuthSection onNavigate={() => onOpenChange(false)} />}
    />
  );
}
