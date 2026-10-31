"use client";

import { LaxLogo } from "@/components/layout/lax-logo";
import { ShellUserMenu } from "@/components/layout/shell-user-menu";
import { useViewingAsClient } from "@/components/layout/view-as-client/view-as-client-context";
import { ViewAsClientMenu } from "@/components/layout/view-as-client/view-as-client-menu";
import { SITE_LOGO_PATH, SITE_LOGO_SHORT_PATH } from "@/lib/brand";
import type { SessionUser } from "@/lib/data/contracts";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import type { MobileShellTitleModel } from "@/lib/navigation/mobile-shell-title";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { LaxFamilyBar } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PhoneAccountButton } from "./phone-account-button";

/** The shell the shared header parts draw for. */
const CLIENT_SHELL_ROLE = "client" as const;

/**
 * The workspace's one top bar, 48px:
 * - from 1024px, the Bid lockup over the 240px sidebar, then the LAX family links from the
 *   content's left edge, the search field and the person's menu on the right;
 * - on a phone, the compact lockup (or a back button on a nested page), the page's title once
 *   its large title has scrolled away, then search and the person's menu.
 * The account is named only by the switcher, never here.
 */
export function WorkspaceTopBar({
  user,
  familyLinks,
  search,
  phoneTitle,
  scrolledTitle,
  phoneAccountSheet = null,
}: {
  user: SessionUser;
  familyLinks: readonly LaxFamilyLinkVm[];
  /** The search field (and its phone icon button). */
  search: ReactNode;
  /** The nested page's way back on a phone, from the breadcrumb trail. */
  phoneTitle: MobileShellTitleModel;
  /** The page's title, once its large title has scrolled out of view. */
  scrolledTitle: string | null;
  /**
   * The accounts the person can switch between. When set, the avatar on a phone opens the
   * account sheet instead of the person menu; from 1024px the person menu stays.
   */
  phoneAccountSheet?: AccountChrome["switcher"];
}) {
  const viewingAs = useViewingAsClient();
  const showTitle = Boolean(scrolledTitle) || Boolean(phoneTitle.backHref);
  return (
    <header className="z-30 flex h-12 shrink-0 items-stretch border-b border-lax-line bg-lax-page pt-[env(safe-area-inset-top,0px)] max-lg:h-[calc(3.25rem+env(safe-area-inset-top,0px))]">
      <div className="hidden w-60 shrink-0 items-center border-r border-lax-line bg-lax-side px-6 lg:flex">
        <Link
          href="/home"
          aria-label="Bid home"
          className="lax-focus inline-flex rounded-lax-control"
        >
          <LaxLogo
            variant="header"
            imageSrc={SITE_LOGO_PATH}
            imageWidth={430}
            imageHeight={202}
            className="[&_img]:h-7 [&_img]:max-w-[120px]"
          />
        </Link>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2 lg:gap-4 lg:px-10">
        <div className="flex min-w-0 flex-1 items-center gap-1 lg:hidden">
          {phoneTitle.backHref ? (
            <Link
              href={phoneTitle.backHref}
              aria-label={phoneTitle.backLabel ? `Back to ${phoneTitle.backLabel}` : "Go back"}
              className="lax-focus inline-flex size-11 shrink-0 items-center justify-center rounded-lax-control text-lax-fg hover:bg-lax-hover"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
          ) : null}
          {showTitle ? (
            <p
              aria-hidden
              className={cn(
                "min-w-0 truncate font-lax-display text-lax-16 font-semibold text-lax-fg",
                !phoneTitle.backHref && "pl-2",
              )}
            >
              {scrolledTitle ?? phoneTitle.title}
            </p>
          ) : (
            <Link
              href="/home"
              aria-label="Bid home"
              className="lax-focus inline-flex rounded-lax-control px-2"
            >
              <LaxLogo
                variant="header"
                imageSrc={SITE_LOGO_SHORT_PATH}
                imageWidth={172}
                imageHeight={201}
                className="[&_img]:h-7 [&_img]:w-auto"
              />
            </Link>
          )}
        </div>
        <LaxFamilyBar links={familyLinks} className="min-h-0 flex-1" />
        <div className="flex shrink-0 items-center gap-1 lg:gap-3">
          {search}
          {viewingAs ? (
            <ViewAsClientMenu name={viewingAs.name} />
          ) : phoneAccountSheet ? (
            <>
              <div className="lg:hidden">
                <PhoneAccountButton user={user} switcher={phoneAccountSheet} />
              </div>
              <div className="max-lg:hidden">
                <ShellUserMenu user={user} role={CLIENT_SHELL_ROLE} />
              </div>
            </>
          ) : (
            <ShellUserMenu user={user} role={CLIENT_SHELL_ROLE} />
          )}
        </div>
      </div>
    </header>
  );
}
