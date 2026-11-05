"use client";

import { ArtLockup } from "@/components/header/art-lockup";
import { ArtThemeToggle } from "@/components/header/art-theme-toggle";
import { ART_HELP_LINKS } from "@/lib/layout/art-help-links";
import { buildArtMegaNavSections } from "@/lib/layout/art-nav.vm";
import { FOCUS_RING } from "@auction/branding";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { MarketingPhoneMenu } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";
import { type RefObject, useMemo } from "react";

type ArtPhoneMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  activeKey: string | null;
  familyLinks: readonly LaxFamilyLinkVm[];
  returnFocusRef: RefObject<HTMLElement | null>;
};

/**
 * lax.art's menu below 1024px: lockup and Close, the LAX top bar row, the main nav (flat links),
 * help links and Theme last. Search and account live in the bars, not here.
 */
export function ArtPhoneMenu({
  open,
  onOpenChange,
  pathname,
  activeKey,
  familyLinks,
  returnFocusRef,
}: ArtPhoneMenuProps) {
  const sections = useMemo(() => buildArtMegaNavSections(null), []);
  return (
    <MarketingPhoneMenu
      open={open}
      onOpenChange={onOpenChange}
      resetKey={pathname}
      lockup={
        <Link
          href="/"
          className={cn("shrink-0 rounded-sm", FOCUS_RING)}
          aria-label="lax.art home"
          onClick={() => onOpenChange(false)}
        >
          <ArtLockup />
        </Link>
      }
      familyLinks={familyLinks}
      sections={sections}
      isSectionActive={(section) => section.key === activeKey}
      helpLinks={ART_HELP_LINKS}
      themeSlot={
        <>
          <span className="font-label text-xs font-semibold text-on-surface-variant">Theme</span>
          <ArtThemeToggle />
        </>
      }
      returnFocusRef={returnFocusRef}
    />
  );
}
