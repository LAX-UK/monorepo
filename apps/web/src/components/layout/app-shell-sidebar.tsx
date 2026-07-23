"use client";

import { WorkspaceModeSwitcher } from "@/components/dashboard/workspace-mode-switcher";
import { type AppShellRole, appShellRoleMeta } from "@/components/layout/app-shell-nav";
import { LaxLogo } from "@/components/layout/lax-logo";
import { SidebarCollapseButton } from "@/components/layout/sidebar-collapse-button";
import { useSidebarState } from "@/components/layout/sidebar-state";
import { StaffSidebarNav } from "@/components/layout/staff-sidebar-nav";
import { StaffWorkspaceSwitcher } from "@/components/layout/staff-workspace-switcher";
import { shellRolePillLabel } from "@/lib/admin/staff-role-presenter";
import { SITE_LOGO_PATH, SITE_LOGO_SHORT_PATH } from "@/lib/brand";
import type { SessionUser } from "@/lib/data/contracts";
import { navBadgeClassName } from "@/lib/layout/nav-badge-classes";
import { navEntriesToFlatItems, navEntriesToGroups } from "@/lib/shell/nav-adapters";
import { useShellConfig } from "@/lib/shell/shell-config-context";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: SessionUser;
  role: AppShellRole;
  onNavigate?: () => void;
  collapsible?: boolean;
  /** Collector vs seller workspace (client shell only). */
  clientWorkspaceMode?: ClientWorkspaceMode;
  /** When false, logo block is omitted (logo lives in the top bar). */
  showLogo?: boolean;
};

export function AppShellSidebar({
  user,
  role,
  onNavigate,
  collapsible = false,
  clientWorkspaceMode = "buying",
  showLogo = true,
}: Props) {
  const pathname = usePathname();
  const config = useShellConfig();
  const meta = appShellRoleMeta[role];
  const clientNavItems = navEntriesToFlatItems(config.nav);
  const staffNavGroups = navEntriesToGroups(config.nav);
  const { collapsed } = useSidebarState();
  const labelsHidden = collapsible && collapsed;
  const rolePillLabel = shellRolePillLabel(user);

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
      className={cn("flex items-center gap-2", labelsHidden ? "justify-center" : "justify-between")}
    >
      {rolePill}
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
        className={cn("min-h-0 flex-1 overflow-y-auto px-2 py-4", !labelsHidden && "px-3")}
        aria-label={`${meta.label} dashboard`}
      >
        {showLogo ? <div className="mb-4">{roleRow}</div> : null}
        {role === "client" ? (
          <div className="space-y-1">
            {clientNavItems.map((item) => {
              const active = item.match
                ? item.match(pathname)
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Tooltip key={item.id} delayDuration={400}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      {...(onNavigate ? { onClick: onNavigate } : {})}
                      aria-current={active ? "page" : undefined}
                      aria-label={item.label}
                      className={cn(
                        "group relative flex min-h-[var(--tap-target-min,44px)] items-center justify-center gap-3 rounded-lg px-2 py-2 font-label text-[13px] font-medium text-on-surface-variant transition-colors",
                        !labelsHidden && "justify-start px-3",
                        "hover:bg-surface-container-high hover:text-on-surface",
                        active &&
                          "border-l-2 border-nav-active-border bg-nav-active-bg pl-[calc(0.75rem-2px)] text-on-surface",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate whitespace-nowrap transition-[max-width,opacity] duration-150",
                          labelsHidden ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100",
                        )}
                        aria-hidden={labelsHidden}
                      >
                        {item.label}
                      </span>
                      {item.badge ? (
                        <Badge
                          className={cn(
                            navBadgeClassName(item.badgeTone),
                            labelsHidden && "absolute right-1 top-1",
                          )}
                          aria-label={`${item.badge > 99 ? "99+" : item.badge} pending ${item.label}`}
                        >
                          {item.badge > 99 ? "99+" : item.badge}
                        </Badge>
                      ) : null}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className={cn("hidden", labelsHidden && "lg:block")}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <StaffSidebarNav
            groups={staffNavGroups}
            labelsHidden={labelsHidden}
            {...(onNavigate ? { onNavigate } : {})}
          />
        )}
      </nav>

      <div className="border-t border-shell-stroke bg-surface-container-low p-3">
        {role === "client" ? (
          labelsHidden ? (
            <div className="flex justify-center">
              <Tooltip delayDuration={250}>
                <TooltipTrigger asChild>
                  <div>
                    <WorkspaceModeSwitcher mode={clientWorkspaceMode} variant="compact" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="hidden lg:block">
                  {clientWorkspaceMode === "buying" ? "Buying workspace" : "Selling workspace"}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <WorkspaceModeSwitcher mode={clientWorkspaceMode} />
          )
        ) : (
          <StaffWorkspaceSwitcher collapsed={labelsHidden} />
        )}
      </div>
    </div>
  );
}
