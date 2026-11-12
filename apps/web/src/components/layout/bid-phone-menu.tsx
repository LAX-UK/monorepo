"use client";

import { BidHeaderLockup } from "@/components/layout/bid-header-lockup";
import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { megaMenuSectionActive, utilityNav } from "@/components/layout/header-nav-config";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { linkIsCurrent } from "@/lib/nav/is-current";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { MarketingPhoneMenu } from "@auction/marketing-ui/header/marketing-phone-menu";
import type { RefObject } from "react";

type BidPhoneMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  searchParams: Pick<URLSearchParams, "get"> | null;
  sections: MegaMenuSection[];
  /** The other LAX products and LAX Account, which the hidden top bar would show. */
  familyLinks?: readonly LaxFamilyLinkVm[];
  /** The menu button; focus returns here when the menu closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Bid's phone menu: lockup and Close, the LAX top bar row, the main navigation, the help links
 * (About us, Contact us, FAQ) and Theme last. No search and no account: those have their own
 * place in the bars.
 */
export function BidPhoneMenu({
  open,
  onOpenChange,
  pathname,
  searchParams,
  sections,
  familyLinks = [],
  returnFocusRef,
}: BidPhoneMenuProps) {
  const searchKey = searchParams == null ? "" : searchParams.toString();
  return (
    <MarketingPhoneMenu
      open={open}
      onOpenChange={onOpenChange}
      resetKey={`${pathname}:${searchKey}`}
      lockup={<BidHeaderLockup onNavigate={() => onOpenChange(false)} />}
      familyLinks={familyLinks}
      sections={sections}
      isSectionActive={(section) => megaMenuSectionActive(pathname, section)}
      isLinkCurrent={(href) => linkIsCurrent(pathname, href)}
      helpLinks={utilityNav}
      themeSlot={
        <>
          <span className="font-label text-xs font-semibold text-on-surface-variant">Theme</span>
          <ThemeToggle />
        </>
      }
      {...(returnFocusRef ? { returnFocusRef } : {})}
    />
  );
}
