"use client";

import { LaxProductSwitcher } from "@/components/ecosystem/lax-product-switcher";
import { ArtAccountStatus } from "@/components/header/art-account-status";
import { ArtThemeToggle } from "@/components/header/art-theme-toggle";
import { ArtLaxLogo } from "@/components/layout/art-lax-logo";
import { buildArtNavItems } from "@/lib/layout/art-nav.vm";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ArtHeaderClientProps = {
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
};

export function ArtHeaderClient({ account, productLinks }: ArtHeaderClientProps) {
  const pathname = usePathname();
  const nav = buildArtNavItems(pathname, { includeHome: false });

  return (
    <header
      data-testid="art-header"
      className="fixed top-0 z-50 w-full border-b border-nav-border bg-surface/95 pt-[env(safe-area-inset-top,0px)] shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-surface"
    >
      <div
        className={cn(
          MARKETING_PAGE_GUTTER_X,
          "mx-auto flex h-14 max-w-[var(--container-max,1440px)] items-center justify-between gap-4 lg:h-16",
        )}
      >
        <ArtLaxLogo />
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center font-label text-sm uppercase tracking-wide transition-colors hover:text-on-surface",
                FOCUS_RING,
                item.active
                  ? "text-on-surface underline decoration-1 underline-offset-8"
                  : "text-on-surface-variant",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LaxProductSwitcher links={productLinks} />
          <ArtThemeToggle />
          <ArtAccountStatus account={account} returnTo={pathname} />
        </div>
      </div>
    </header>
  );
}
