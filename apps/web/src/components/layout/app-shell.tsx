"use client";

import { AppShellBreadcrumbs } from "@/components/layout/app-shell-breadcrumbs";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import { AppShellSidebar } from "@/components/layout/app-shell-sidebar";
import { openCommandPalette } from "@/components/layout/command-palette-events";
import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { DensityProvider, useDashboardDensity } from "@/components/layout/density-provider";
import { SidebarStateProvider, useSidebarState } from "@/components/layout/sidebar-state";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TweaksPopover } from "@/components/layout/tweaks-popover";
import type { SessionUser } from "@/lib/data/contracts";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@auction/ui/components/sheet";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

type Props = {
  user: SessionUser;
  shellRole: AppShellRole;
  pendingSubmissionCount?: number;
  children: ReactNode;
};

function AppShellFrame({ user, shellRole, pendingSubmissionCount = 0, children }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { density } = useDashboardDensity();
  const { collapsed } = useSidebarState();

  useEffect(() => {
    if (pathname.length > 0 && mobileOpen) setMobileOpen(false);
  }, [mobileOpen, pathname]);

  const desktopSidebar = (
    <AppShellSidebar
      user={user}
      role={shellRole}
      pendingSubmissionCount={pendingSubmissionCount}
      onNavigate={() => setMobileOpen(false)}
      collapsible
    />
  );
  const mobileSidebar = (
    <AppShellSidebar
      user={user}
      role={shellRole}
      pendingSubmissionCount={pendingSubmissionCount}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <div
      className="flex min-h-[100dvh] bg-page-bg font-body text-on-surface"
      style={{ ["--sidebar-width" as string]: collapsed ? "4.5rem" : "14rem" }}
    >
      <CommandPaletteLazy
        variant={shellRole === "client" ? "dashboard" : "admin"}
        sessionUser={user}
      />
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[60] -translate-y-[120%] rounded-md bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-primary focus:translate-y-0 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
      >
        Skip to content
      </a>

      <aside className="hidden h-[100dvh] w-[var(--sidebar-width)] shrink-0 border-r border-outline-variant bg-surface-container-lowest transition-[width] duration-200 lg:block">
        {desktopSidebar}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[min(100vw-1.5rem,14rem)] max-w-none border-outline-variant bg-surface-container-lowest p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Dashboard navigation</SheetTitle>
          </SheetHeader>
          {mobileSidebar}
        </SheetContent>
      </Sheet>

      <div className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-10 min-w-10 text-on-surface-variant lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open dashboard navigation"
            >
              <Menu className="size-5" aria-hidden />
            </Button>
            <AppShellBreadcrumbs role={shellRole} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] text-secondary hover:bg-surface-container-low hover:text-primary lg:hidden"
              onClick={openCommandPalette}
              aria-label="Open command palette"
            >
              <Search className="size-4" aria-hidden />
            </Button>
            <ThemeToggle />
            <TweaksPopover />
          </div>
        </header>

        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div
            className={cn(
              "mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8",
              "data-[density=compact]:md:px-6 data-[density=compact]:md:py-6",
            )}
            data-density={density}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppShell(props: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <DensityProvider>
        <SidebarStateProvider>
          <AppShellFrame {...props} />
        </SidebarStateProvider>
      </DensityProvider>
    </TooltipProvider>
  );
}

export { useTableDensity } from "@/components/layout/density-provider";
