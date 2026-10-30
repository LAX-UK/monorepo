"use client";

import { AccountStrip } from "@/components/layout/account-switcher/account-strip";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import { AppShellSidebar } from "@/components/layout/app-shell-sidebar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { ClientShellHeader } from "@/components/layout/client-shell-header";
import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { DensityProvider } from "@/components/layout/density-provider";
import { ShellMain } from "@/components/layout/shell-main";
import { SidebarStateProvider, useSidebarState } from "@/components/layout/sidebar-state";
import { StaffRouteRecentTracker } from "@/components/layout/staff-route-recent-tracker";
import { StaffShellHeader } from "@/components/layout/staff-shell-header";
import type { SessionUser } from "@/lib/data/contracts";
import { HotkeyProvider } from "@/lib/hotkeys/hotkey-provider";
import { StaffGlobalHotkeys } from "@/lib/hotkeys/staff-global-hotkeys";
import type { DashboardDensity } from "@/lib/preferences/density";
import type { ShellConfig } from "@/lib/shell/contracts";
import { ShellChromeProvider, useShellChrome } from "@/lib/shell/shell-chrome-context";
import { ShellConfigProvider } from "@/lib/shell/shell-config-context";
import { LaxFamilyBar } from "@auction/marketing-ui";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { LaxDensityProvider, laxDensityAttributes } from "@auction/ui/lax";
import { type ReactNode, useEffect } from "react";

type Props = {
  user: SessionUser;
  config: ShellConfig;
  children: ReactNode;
  /** Staff only: the density chosen on another device. */
  cookieDensity?: DashboardDensity | null;
};

function AppShellFrame({ user, config, children }: Props) {
  const { hideBottomTabBar: hideBottomTabBarOverride } = useShellChrome();
  const shellRole = config.role as AppShellRole;
  const hideBottomTabBar = config.hideBottomTabBar || hideBottomTabBarOverride;
  const pendingSubmissionCount = config.pendingSubmissionCount ?? 0;
  const pendingArtistCount = config.pendingArtistCount ?? 0;
  const navCounts = config.navCounts;
  const clientAccount = config.clientAccount;
  const hideEmailStatusBanner = config.hideEmailStatusBanner ?? false;
  const headerActionsSlot = config.header.actionsSlot;
  const headerExtraSlot = config.header.extraSlot;
  const contextBanner = config.contextBanner;
  const topSlot = config.topSlot;
  const isStaffShell = shellRole !== "client";
  const { collapsed, toggleCollapsed } = useSidebarState();
  const expandedSidebarWidth = "var(--sidebar-width-expanded, 15.625rem)";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event?.key) return;
      const key = event.key.toLowerCase();
      if (key !== "b" || (!event.metaKey && !event.ctrlKey)) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      event.preventDefault();
      toggleCollapsed();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  const desktopSidebar = <AppShellSidebar user={user} role={shellRole} collapsible />;
  const familyLinks = isStaffShell ? [] : (config.familyLinks ?? []);

  const density = isStaffShell ? "staff" : "client";

  return (
    <LaxDensityProvider density={density}>
      <div
        {...laxDensityAttributes(density)}
        className="flex h-[calc(100dvh-var(--view-as-client-banner-height,0px))] flex-col overflow-hidden bg-shell-page-bg font-body text-on-surface"
        style={{
          ["--sidebar-width" as string]: collapsed ? "4.5rem" : expandedSidebarWidth,
        }}
      >
        {familyLinks.length > 0 ? (
          <div className="hidden shrink-0 border-b border-shell-stroke bg-surface-container-lowest px-6 lg:block">
            <LaxFamilyBar links={familyLinks} />
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <CommandPaletteLazy
            variant={shellRole === "client" ? "dashboard" : "admin"}
            sessionUser={user}
            {...(shellRole === "client"
              ? {}
              : {
                  shellRole,
                  pendingSubmissionCount,
                  pendingArtistCount,
                  ...(navCounts ? { navCounts } : {}),
                })}
          />

          <aside className="relative z-20 hidden h-full w-[var(--sidebar-width)] shrink-0 overflow-visible border-r border-shell-stroke bg-shell-sidebar shadow-[2px_0_12px_-4px_rgba(0,0,0,0.08)] transition-[width] duration-200 ease-out lg:flex lg:flex-col dark:shadow-[2px_0_12px_-4px_rgba(0,0,0,0.35)]">
            {desktopSidebar}
          </aside>

          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <header className="z-30 shrink-0 border-b border-shell-stroke bg-surface-container-lowest pt-[env(safe-area-inset-top,0px)] shadow-[var(--shadow-rest)]">
              <div className="mx-auto flex h-[var(--header-height-mobile,56px)] max-w-[var(--container-inner,1376px)] flex-nowrap items-center gap-3 px-3 sm:px-4 md:px-8 lg:h-[var(--header-height-shell,82px)] lg:gap-6 lg:px-8">
                {isStaffShell ? (
                  <StaffShellHeader
                    user={user}
                    role={shellRole}
                    actionsSlot={headerActionsSlot}
                    extraSlot={headerExtraSlot}
                  />
                ) : (
                  <ClientShellHeader
                    user={user}
                    role={shellRole}
                    account={clientAccount}
                    actionsSlot={headerActionsSlot}
                    extraSlot={headerExtraSlot}
                  />
                )}
              </div>
            </header>

            {clientAccount?.strip ? <AccountStrip strip={clientAccount.strip} /> : null}

            <ShellMain
              user={user}
              shellRole={shellRole}
              hideEmailStatusBanner={hideEmailStatusBanner}
              mobileNavCount={config.mobileNav.length}
              topSlot={topSlot}
              contextBanner={contextBanner}
            >
              {children}
            </ShellMain>
          </div>
        </div>

        {config.mobileNav.length > 0 && !hideBottomTabBar ? <BottomTabBar user={user} /> : null}
      </div>
    </LaxDensityProvider>
  );
}

/**
 * Staff choose a compact or comfortable density; the organisation workspace has one layout,
 * so it has no density provider and any stored preference is ignored there.
 */
function StaffDensity({
  enabled,
  cookieDensity,
  children,
}: {
  enabled: boolean;
  cookieDensity: DashboardDensity | null | undefined;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return <DensityProvider cookieDensity={cookieDensity ?? null}>{children}</DensityProvider>;
}

export function AppShell({ user, config, children, cookieDensity }: Props) {
  const isStaffShell = config.role !== "client";
  return (
    <HotkeyProvider scope={isStaffShell ? "page" : "global"}>
      {isStaffShell ? (
        <>
          <StaffGlobalHotkeys />
          <StaffRouteRecentTracker />
        </>
      ) : null}
      <ShellConfigProvider config={config}>
        <ShellChromeProvider>
          <TooltipProvider delayDuration={200}>
            <StaffDensity enabled={isStaffShell} cookieDensity={cookieDensity}>
              <SidebarStateProvider>
                <AppShellFrame user={user} config={config}>
                  {children}
                </AppShellFrame>
              </SidebarStateProvider>
            </StaffDensity>
          </TooltipProvider>
        </ShellChromeProvider>
      </ShellConfigProvider>
    </HotkeyProvider>
  );
}

export { useTableDensity } from "@/components/layout/density-provider";
