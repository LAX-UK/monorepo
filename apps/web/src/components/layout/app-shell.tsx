"use client";

import { AppShellBreadcrumbs } from "@/components/layout/app-shell-breadcrumbs";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import { AppShellSidebar } from "@/components/layout/app-shell-sidebar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { openCommandPalette } from "@/components/layout/command-palette-events";
import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { DensityProvider, useDashboardDensity } from "@/components/layout/density-provider";
import { EmailStatusBanner } from "@/components/layout/email-status-banner";
import { SidebarStateProvider, useSidebarState } from "@/components/layout/sidebar-state";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TweaksPopover } from "@/components/layout/tweaks-popover";
import type { SessionUser } from "@/lib/data/contracts";
import type { DashboardDensity } from "@/lib/preferences/density";
import type { ShellConfig } from "@/lib/shell/contracts";
import { ShellChromeProvider, useShellChrome } from "@/lib/shell/shell-chrome-context";
import { ShellConfigProvider } from "@/lib/shell/shell-config-context";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@auction/ui/components/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import { ChevronLeft, ChevronRight, ExternalLink, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

type Props = {
  user: SessionUser;
  config: ShellConfig;
  children: ReactNode;
  cookieDensity?: DashboardDensity | null;
};

function AppShellFrame({ user, config, children }: Props) {
  const { hideBottomTabBar: hideBottomTabBarOverride } = useShellChrome();
  const shellRole = config.role as AppShellRole;
  const hideBottomTabBar = config.hideBottomTabBar || hideBottomTabBarOverride;
  const pendingSubmissionCount = config.pendingSubmissionCount ?? 0;
  const pendingArtistCount = config.pendingArtistCount ?? 0;
  const clientWorkspaceMode = config.clientWorkspaceMode ?? "buying";
  const hideEmailStatusBanner = config.hideEmailStatusBanner ?? false;
  const headerLeftSlot = config.header.leftSlot;
  const headerRightSlot = config.header.rightSlot;
  const contextBanner = config.contextBanner;
  const topSlot = config.topSlot;
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { density } = useDashboardDensity();
  const { collapsed, peeking, setPeeking, toggleCollapsed } = useSidebarState();
  const sidebarShellRef = useRef<HTMLDivElement | null>(null);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPeekOpen = collapsed && peeking;

  useEffect(() => {
    if (pathname.length > 0 && mobileOpen) setMobileOpen(false);
  }, [mobileOpen, pathname]);

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

  useEffect(() => {
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (collapsed) return;
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    setPeeking(false);
  }, [collapsed, setPeeking]);

  const schedulePeek = (nextPeeking: boolean, delayMs: number) => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      setPeeking(collapsed && nextPeeking);
    }, delayMs);
  };

  const openPeek = () => {
    if (collapsed) schedulePeek(true, 120);
  };

  const closePeek = () => {
    schedulePeek(false, 200);
  };

  const desktopSidebar = (
    <AppShellSidebar
      user={user}
      role={shellRole}
      onNavigate={() => setMobileOpen(false)}
      collapsible
      {...(shellRole === "client" ? { clientWorkspaceMode } : {})}
    />
  );
  const mobileSidebar = (
    <AppShellSidebar
      user={user}
      role={shellRole}
      onNavigate={() => setMobileOpen(false)}
      {...(shellRole === "client" ? { clientWorkspaceMode } : {})}
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
        {...(shellRole === "client"
          ? { clientWorkspaceMode }
          : { pendingSubmissionCount, pendingArtistCount })}
      />

      <div
        ref={sidebarShellRef}
        className="relative hidden h-[100dvh] w-[var(--sidebar-width)] shrink-0 overflow-visible transition-[width] duration-200 ease-out lg:block"
        onMouseEnter={openPeek}
        onMouseLeave={closePeek}
        onFocusCapture={openPeek}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget;
          if (nextTarget instanceof Node && sidebarShellRef.current?.contains(nextTarget)) return;
          closePeek();
        }}
      >
        <aside
          className={cn(
            "h-full border-r border-outline-variant bg-surface-container-lowest transition-[width,box-shadow] duration-200 ease-out",
            isPeekOpen
              ? "absolute inset-y-0 left-0 z-40 w-56 shadow-2xl"
              : "relative w-[var(--sidebar-width)] shadow-none",
          )}
        >
          {desktopSidebar}
          <SidebarEdgeHandle collapsed={collapsed} onToggle={toggleCollapsed} />
        </aside>
      </div>

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

      <div className="flex h-[100dvh] flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-[var(--header-height-shell,52px)] min-h-[var(--tap-target-min,44px)] shrink-0 items-center justify-between border-b border-border-soft bg-surface-container-lowest px-4 md:px-8 max-lg:min-h-[var(--header-height-mobile,56px)]">
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
            <AppShellBreadcrumbs
              role={shellRole}
              sessionUser={user}
              {...(shellRole === "client" ? { clientWorkspaceMode } : {})}
            />
            {shellRole === "client" ? (
              <Link
                href="/"
                prefetch
                aria-label="View public LAX site"
                className="hidden min-h-11 items-center gap-2 rounded-md px-3 font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                <span>View site</span>
              </Link>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerRightSlot}
            {headerLeftSlot}
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

        <main
          id="main-content"
          className={cn(
            "min-h-0 flex-1 scroll-mt-[52px] overflow-y-auto overflow-x-hidden",
            config.mobileNav.length > 0 && !hideBottomTabBar && "pb-20 lg:pb-0",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full max-w-[var(--container-inner,1376px)] px-4 py-6 md:px-8 md:py-8 lg:px-14",
              "data-[density=compact]:md:px-6 data-[density=compact]:md:py-6 data-[density=compact]:lg:px-10",
            )}
            data-density={density}
          >
            {topSlot ? <div className="mb-6">{topSlot}</div> : null}
            {hideEmailStatusBanner ? null : <EmailStatusBanner user={user} />}
            {contextBanner ? <div className="mb-6 space-y-4">{contextBanner}</div> : null}
            {children}
          </div>
        </main>
      </div>
      {config.mobileNav.length > 0 && !hideBottomTabBar ? <BottomTabBar /> : null}
    </div>
  );
}

export function AppShell({ user, config, children, cookieDensity }: Props) {
  return (
    <ShellConfigProvider config={config}>
      <ShellChromeProvider>
        <TooltipProvider delayDuration={200}>
          <DensityProvider cookieDensity={cookieDensity ?? null}>
            <SidebarStateProvider>
              <AppShellFrame user={user} config={config}>
                {children}
              </AppShellFrame>
            </SidebarStateProvider>
          </DensityProvider>
        </TooltipProvider>
      </ShellChromeProvider>
    </ShellConfigProvider>
  );
}

function SidebarEdgeHandle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const Icon = collapsed ? ChevronRight : ChevronLeft;

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="absolute right-0 top-1/2 z-50 size-7 min-h-7 min-w-7 translate-x-1/2 -translate-y-1/2 rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant opacity-80 shadow-sm transition-[background-color,color,opacity,transform] duration-150 hover:scale-105 hover:bg-surface-container-high hover:text-on-surface hover:opacity-100 focus-visible:opacity-100"
          aria-label={label}
          aria-pressed={collapsed}
        >
          <Icon className="size-3.5" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {label}{" "}
        <span className="text-on-surface-variant">
          {typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
            ? "(⌘B)"
            : "(Ctrl+B)"}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export { useTableDensity } from "@/components/layout/density-provider";
