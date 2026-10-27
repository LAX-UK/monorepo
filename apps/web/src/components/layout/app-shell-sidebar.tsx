"use client";

import { AccountSwitcher } from "@/components/layout/account-switcher/account-switcher";
import { type AppShellRole, appShellRoleMeta } from "@/components/layout/app-shell-nav";
import { ClientSidebarNav } from "@/components/layout/client-sidebar-nav";
import { LaxLogo } from "@/components/layout/lax-logo";
import { SidebarCollapseButton } from "@/components/layout/sidebar-collapse-button";
import { useSidebarState } from "@/components/layout/sidebar-state";
import { StaffSidebarNav } from "@/components/layout/staff-sidebar-nav";
import { StaffWorkspaceSwitcher } from "@/components/layout/staff-workspace-switcher";
import { shellRolePillLabel } from "@/lib/admin/staff-role-presenter";
import { SITE_LOGO_PATH, SITE_LOGO_SHORT_PATH } from "@/lib/brand";
import type { SessionUser } from "@/lib/data/contracts";
import { navEntriesToGroups } from "@/lib/shell/nav-adapters";
import { useShellConfig } from "@/lib/shell/shell-config-context";
import { cn } from "@auction/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import Link from "next/link";

type Props = {
  user: SessionUser;
  role: AppShellRole;
  onNavigate?: () => void;
  collapsible?: boolean;
  /** When false, logo block is omitted (logo lives in the top bar). */
  showLogo?: boolean;
};

export function AppShellSidebar({
  user,
  role,
  onNavigate,
  collapsible = false,
  showLogo = true,
}: Props) {
  const config = useShellConfig();
  const meta = appShellRoleMeta[role];
  const staffNavGroups = navEntriesToGroups(config.nav);
  const { collapsed } = useSidebarState();
  const labelsHidden = collapsible && collapsed;
  const rolePillLabel = shellRolePillLabel(user);
  const showAccountHint = user.hasSeenActingContextTooltip === false;

  const rolePill = (
    <Tooltip delayDuration={labelsHidden ? 250 : 400}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border-hairline bg-surface-container px-2.5 py-1.5 shadow-sm",
            !labelsHidden && "px-3",
            meta.pillClassName,
            labelsHidden && "justify-center px-2",
          )}
        >
          <span className={cn("size-1.5 rounded-full", meta.dotClassName)} aria-hidden />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap font-label text-[10px] font-semibold uppercase tracking-[0.12em] transition-[max-width,opacity] duration-150",
              labelsHidden ? "max-w-0 opacity-0" : "max-w-32 opacity-100",
            )}
            aria-hidden={labelsHidden}
          >
            {rolePillLabel}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{rolePillLabel}</TooltipContent>
    </Tooltip>
  );

  const roleRow = (
    <div
      className={cn(
        "flex items-center gap-2",
        labelsHidden ? "justify-center" : role === "client" ? "justify-end" : "justify-between",
      )}
    >
      {/* The staff role pill tells staff which surface they are in; a client has only one. */}
      {role === "client" ? null : rolePill}
      {collapsible ? <SidebarCollapseButton /> : null}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-container-low">
      {showLogo ? (
        <div className="shrink-0 border-b border-shell-stroke pt-[env(safe-area-inset-top,0px)]">
          <div
            className={cn(
              "flex h-[var(--header-height-shell,82px)] items-center px-3",
              !labelsHidden && "px-5",
              labelsHidden && "justify-center",
            )}
          >
            <Link
              href="/"
              className={cn(
                "inline-flex items-center gap-2",
                !labelsHidden ? "min-w-0 justify-start" : "justify-center",
              )}
              aria-label="LAX home"
            >
              <LaxLogo
                variant="header"
                imageSrc={labelsHidden ? SITE_LOGO_SHORT_PATH : SITE_LOGO_PATH}
                imageWidth={labelsHidden ? 172 : 430}
                imageHeight={labelsHidden ? 201 : 202}
                className={cn(labelsHidden ? "max-h-9 w-auto max-w-none" : "max-w-[128px]")}
              />
              <span className="size-1.5 shrink-0 rounded-full bg-accent-brand" aria-hidden />
            </Link>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-b border-shell-stroke pt-[env(safe-area-inset-top,0px)]">
          <div
            className={cn(
              "flex h-[var(--header-height-shell,82px)] items-center px-3",
              !labelsHidden && "px-4",
            )}
          >
            {roleRow}
          </div>
        </div>
      )}

      <nav
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-2 py-4",
          !labelsHidden && "px-3",
          role === "client" && "flex flex-col",
        )}
        aria-label={role === "client" ? "Bid" : `${meta.label} dashboard`}
      >
        {showLogo ? <div className="mb-4">{roleRow}</div> : null}
        {role === "client" && config.clientAccount?.switcher ? (
          <div className="mb-5">
            <AccountSwitcher
              account={config.clientAccount}
              collapsed={labelsHidden}
              showHint={showAccountHint}
            />
          </div>
        ) : null}
        {role === "client" ? (
          <ClientSidebarNav
            sections={config.navSections ?? []}
            labelsHidden={labelsHidden}
            {...(onNavigate ? { onNavigate } : {})}
          />
        ) : (
          <StaffSidebarNav
            groups={staffNavGroups}
            labelsHidden={labelsHidden}
            {...(onNavigate ? { onNavigate } : {})}
          />
        )}
      </nav>

      {role === "client" ? null : (
        <div className="border-t border-shell-stroke bg-surface-container-low p-3">
          <StaffWorkspaceSwitcher collapsed={labelsHidden} />
        </div>
      )}
    </div>
  );
}
