"use client";

import { AppShellBreadcrumbs } from "@/components/layout/app-shell-breadcrumbs";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import { useDashboardDensity } from "@/components/layout/density-provider";
import { EmailStatusBanner } from "@/components/layout/email-status-banner";
import type { SessionUser } from "@/lib/data/contracts";
import { shouldHideStaffBreadcrumbs } from "@/lib/layout/should-hide-staff-breadcrumbs";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { cn } from "@auction/ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type ShellMainProps = {
  user: SessionUser;
  shellRole: AppShellRole;
  clientWorkspaceMode: ClientWorkspaceMode;
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
  clientWorkspaceMode,
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
      className={cn(
        "min-h-0 flex-1 scroll-mt-[var(--header-height-mobile,56px)] overflow-y-auto overflow-x-hidden lg:scroll-mt-[var(--header-height-shell,82px)]",
        mobileNavCount > 0 && "pb-[var(--page-bottom-padding)] lg:pb-0",
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-[var(--container-inner,1376px)] px-4 py-6 md:px-8 md:py-8 lg:px-8",
          "data-[density=compact]:md:px-6 data-[density=compact]:md:py-6",
        )}
        data-density={density}
      >
        {shellRole === "client" || (isStaffShell && !hideStaffBreadcrumbs) ? (
          <div className="mb-4 hidden lg:block">
            <AppShellBreadcrumbs
              role={shellRole}
              sessionUser={user}
              variant="desktop"
              {...(shellRole === "client" ? { clientWorkspaceMode } : {})}
            />
          </div>
        ) : null}
        {topSlot ? <div className="mb-6">{topSlot}</div> : null}
        {hideEmailStatusBanner ? null : <EmailStatusBanner user={user} />}
        {contextBanner ? <div className="mb-6 space-y-4">{contextBanner}</div> : null}
        {children}
      </div>
    </main>
  );
}
