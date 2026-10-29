"use client";

import {
  WORKSPACE_COLUMN_STYLE,
  WORKSPACE_PAGE_WIDTH_CLASS,
} from "@/components/dashboard/dashboard-page";
import { AppShellBreadcrumbs } from "@/components/layout/app-shell-breadcrumbs";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import { useDashboardDensity } from "@/components/layout/density-provider";
import { EmailStatusBanner } from "@/components/layout/email-status-banner";
import type { SessionUser } from "@/lib/data/contracts";
import { shouldHideStaffBreadcrumbs } from "@/lib/layout/should-hide-staff-breadcrumbs";
import { cn } from "@auction/ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type ShellMainProps = {
  user: SessionUser;
  shellRole: AppShellRole;
  hideEmailStatusBanner: boolean;
  mobileNavCount: number;
  topSlot?: ReactNode;
  contextBanner?: ReactNode;
  children: ReactNode;
};

/** Main landmark: breadcrumbs, banners, and page content with density wrapper. */
export function ShellMain({
  user,
  shellRole,
  hideEmailStatusBanner,
  mobileNavCount,
  topSlot,
  contextBanner,
  children,
}: ShellMainProps) {
  const pathname = usePathname();
  const isStaffShell = shellRole !== "client";
  const hideStaffBreadcrumbs = shouldHideStaffBreadcrumbs(pathname);
  const { density } = useDashboardDensity();

  return (
    <main
      id="main-content"
      // The main area scrolls on its own, so it must be reachable with Tab: on a page with no links
      // or buttons inside, keyboard users could not otherwise scroll it (axe:
      // scrollable-region-focusable). The ring shows only for keyboard focus.
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard reachable (WCAG 2.1.1)
      tabIndex={0}
      className={cn(
        "min-h-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary scroll-mt-[var(--header-height-mobile,56px)] overflow-y-auto overflow-x-hidden lg:scroll-mt-[var(--header-height-shell,82px)]",
        mobileNavCount > 0 && "pb-[var(--page-bottom-padding)] lg:pb-0",
      )}
    >
      <div
        className={cn(
          // Phones: the page starts 16px under the header strip.
          "mx-auto w-full max-w-[var(--container-inner,1376px)] px-4 pt-4 pb-6 md:px-8 md:py-8 lg:px-8",
          "data-[density=compact]:md:px-6 data-[density=compact]:md:py-6",
        )}
        data-density={density}
        // The organisation workspace has one content column; staff pages keep the full width.
        style={isStaffShell ? undefined : WORKSPACE_COLUMN_STYLE}
      >
        {/* Breadcrumbs and notices line up with the page column they belong to. */}
        <div className={WORKSPACE_PAGE_WIDTH_CLASS}>
          {shellRole === "client" || (isStaffShell && !hideStaffBreadcrumbs) ? (
            <div className="mb-4 hidden lg:block">
              <AppShellBreadcrumbs role={shellRole} sessionUser={user} variant="desktop" />
            </div>
          ) : null}
          {/* A slot whose content renders nothing (no toast this visit) leaves no gap. */}
          {topSlot ? <div className="mb-6 empty:hidden">{topSlot}</div> : null}
          {hideEmailStatusBanner ? null : <EmailStatusBanner user={user} />}
          {contextBanner ? (
            <div className="mb-6 space-y-4 empty:hidden">{contextBanner}</div>
          ) : null}
        </div>
        {children}
      </div>
    </main>
  );
}
