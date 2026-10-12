"use client";

import { ArtMobileAuthSection } from "@/components/header/art-mobile-auth-section";
import { ArtThemeToggle } from "@/components/header/art-theme-toggle";
import type { ArtNavItem } from "@/lib/layout/art-nav.vm";
import { FOCUS_RING } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  LaxLogo,
  type MarketingMegaNavSection,
  MarketingMobileNavDrawer,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

/**
 * Art's primary nav is flat, so it renders in `topSlot` rather than as accordion sections.
 * The theme row lives there too: the shared drawer always renders its sections `<nav>` after
 * `themeSlot`, which would leave an empty gap between the theme row and the menu.
 */
const NO_SECTIONS: readonly MarketingMegaNavSection[] = [];

const SECTION_LABEL =
  "font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant";

const ROW_LINK = cn(
  "flex min-h-11 w-full items-center rounded-sm font-label text-sm font-medium uppercase tracking-wide transition-colors motion-reduce:transition-none",
  FOCUS_RING,
);

type ArtMobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  navItems: readonly ArtNavItem[];
  account: AccountChromeState;
  productLinks: readonly LaxProductLinkVm[];
};

export function ArtMobileNavDrawer({
  open,
  onOpenChange,
  pathname,
  navItems,
  account,
  productLinks,
}: ArtMobileNavDrawerProps) {
  const close = () => onOpenChange(false);
  const otherProducts = productLinks.filter((link) => !link.current);

  return (
    <MarketingMobileNavDrawer
      open={open}
      onOpenChange={onOpenChange}
      resetKey={pathname}
      sections={NO_SECTIONS}
      isSectionActive={() => false}
      logo={
        <Link
          href="/"
          className={cn("shrink-0 rounded-sm", FOCUS_RING)}
          aria-label="LAX Art home"
          onClick={close}
        >
          <LaxLogo variant="header" src="/brand/lax-logo.svg" className="art-header__logo" />
        </Link>
      }
      topSlot={
        <>
          <div className="flex items-center gap-3 border-b border-nav-border pb-4">
            <span className={SECTION_LABEL}>Theme</span>
            <ArtThemeToggle />
          </div>
          <nav aria-label="Main menu" data-testid="art-mobile-nav">
            <ul className="flex flex-col">
              {navItems.map((item) => (
                <li key={item.key} className="border-b border-nav-border last:border-b-0">
                  <Link
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      ROW_LINK,
                      "py-1 text-on-surface-variant hover:text-on-surface aria-[current=page]:font-semibold aria-[current=page]:text-on-surface",
                    )}
                    onClick={close}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {otherProducts.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className={SECTION_LABEL}>LAX products</p>
              <ul className="flex flex-col">
                {otherProducts.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      rel="noopener noreferrer"
                      className={cn(ROW_LINK, "text-on-surface hover:text-on-surface-variant")}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      }
      footerSlot={<ArtMobileAuthSection account={account} pathname={pathname} onNavigate={close} />}
    />
  );
}
