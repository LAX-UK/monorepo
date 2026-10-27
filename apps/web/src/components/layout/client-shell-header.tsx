"use client";

import { AccountHeaderButton } from "@/components/layout/account-switcher/account-header-button";
import { AppShellBreadcrumbs } from "@/components/layout/app-shell-breadcrumbs";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import { ShellUserMenu } from "@/components/layout/shell-user-menu";
import type { SessionUser } from "@/lib/data/contracts";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type ClientShellHeaderProps = {
  user: SessionUser;
  role: AppShellRole;
  account?: AccountChrome | undefined;
  actionsSlot?: ReactNode;
  extraSlot?: ReactNode;
};

/** Client dashboard top bar: mobile breadcrumbs, view-site link, slots, account menu. */
export function ClientShellHeader({
  user,
  role,
  account,
  actionsSlot,
  extraSlot,
}: ClientShellHeaderProps) {
  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:hidden">
          <AppShellBreadcrumbs role={role} sessionUser={user} variant="mobile" />
          <Link
            href="/"
            prefetch
            aria-label="View public LAX site"
            className="hidden min-h-11 items-center gap-2 rounded-md px-3 font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline-flex"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            <span>View site</span>
          </Link>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {actionsSlot}
        {extraSlot}
        {account ? <AccountHeaderButton account={account} /> : null}
        <ShellUserMenu user={user} role={role} />
      </div>
    </>
  );
}
