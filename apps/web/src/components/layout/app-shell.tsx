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
  shellRole: AppShellRole;
  pendingSubmissionCount?: number;
  children: ReactNode;
};

function AppShellFrame({ user, shellRole, pendingSubmissionCount = 0, children }: Props) {
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
      if (event.key.toLowerCase() !== "b" || (!event.metaKey && !event.ctrlKey)) return;
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
        {label} <span className="text-on-surface-variant">(⌘B)</span>
      </TooltipContent>
    </Tooltip>
  );
}

export { useTableDensity } from "@/components/layout/density-provider";
