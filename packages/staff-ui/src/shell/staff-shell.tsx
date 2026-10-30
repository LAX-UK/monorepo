"use client";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@auction/ui/components/sheet";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import {
  Kbd,
  LaxDensityProvider,
  type LinkComponent,
  laxDensityAttributes,
  useReturnFocus,
} from "@auction/ui/lax";
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import * as React from "react";
import { confirmDiscardChanges } from "../forms/unsaved-changes.js";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { StaffTooltip } from "../primitives/menu.js";
import { CommandPalette, useCommandPaletteShortcut } from "./command-palette.js";
import { STAFF_NAV_COOKIE } from "./nav-cookie.js";
import { NavScrollArea } from "./nav-scroll-area.js";
import { ProductMark, ProductSwitcher } from "./product-switcher.js";
import { StaffShortcutsProvider } from "./shortcuts.js";
import { SidebarNav } from "./sidebar-nav.js";
import type { StaffCommand, StaffCommandSearch, StaffNavGroup, StaffProduct } from "./types.js";

export type StaffShellProps = {
  product: StaffProduct;
  /** Tools this person can open, including the current one. */
  products: readonly StaffProduct[];
  navGroups: readonly StaffNavGroup[];
  pathname: string;
  Link: LinkComponent;
  /** Client-side navigation for ⌘K results (e.g. `router.push`). */
  navigate: (href: string) => void;
  /** The AccountMenu, already bound to the session. */
  account: React.ReactNode;
  /** Icons in the top bar before the account menu, e.g. notifications. */
  topBarActions?: React.ReactNode;
  /** A full-width notice above the top bar, e.g. impersonation. */
  banner?: React.ReactNode;
  /** Actions for ⌘K beyond the nav pages. */
  commands?: readonly StaffCommand[];
  /** Live record search for ⌘K. */
  search?: StaffCommandSearch;
  /** Server-read collapsed state, so the first paint has the right width. */
  defaultCollapsed?: boolean;
  /**
   * `?` opens the kit's keyboard shortcuts sheet (default). Turn it off where the app still
   * binds `?` to its own help.
   */
  shortcutsHelp?: boolean;
  children: React.ReactNode;
};

function navCommands(groups: readonly StaffNavGroup[]): StaffCommand[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      id: `nav:${item.href}`,
      label: item.label,
      group: "Go to",
      icon: item.icon,
      href: item.href,
      ...(group.title ? { hint: group.title } : {}),
      ...(item.keywords ? { keywords: item.keywords } : {}),
    })),
  );
}

/**
 * The frame every staff page renders in, for both LAX Admin and Bid admin: a slim grouped nav on
 * the left (240px, collapsible to a 56px rail, a drawer below 1024px), a 52px top bar with ⌘K
 * search and the account menu, and one `<main>` landmark with a skip link to it.
 */
export function StaffShell({
  product,
  products,
  navGroups,
  pathname,
  Link,
  navigate,
  account,
  topBarActions,
  banner,
  commands = [],
  search,
  defaultCollapsed = false,
  shortcutsHelp = true,
  children,
}: StaffShellProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const returnDrawerFocus = useReturnFocus(drawerOpen);
  const togglePalette = React.useCallback(() => setPaletteOpen((open) => !open), []);
  useCommandPaletteShortcut(togglePalette);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${STAFF_NAV_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  const allCommands = React.useMemo(
    () => [...commands, ...navCommands(navGroups)],
    [commands, navGroups],
  );

  // ⌘K never discards a form's unsaved changes without asking first.
  const guardedNavigate = React.useCallback(
    (href: string) => {
      void confirmDiscardChanges().then((discard) => {
        if (discard) navigate(href);
      });
    },
    [navigate],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <LaxDensityProvider density="staff">
        <StaffShortcutsProvider helpShortcut={shortcutsHelp}>
          <div
            data-staff-ui=""
            data-staff-shell=""
            data-staff-product={product.id === "bid-admin" ? "bid" : "lax-admin"}
            {...laxDensityAttributes("staff")}
            // Sticky table headers sit under the top bar.
            className="min-h-dvh bg-staff-canvas font-staff text-staff-fg [--staff-sticky-top:var(--spacing-staff-top-bar)]"
          >
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-staff-sm focus:bg-staff-ink focus:px-3 focus:py-2 focus:text-staff-sm focus:text-staff-on-ink"
            >
              Skip to main content
            </a>
            {banner}
            <div className="flex">
              <div
                className={cn(
                  "hidden shrink-0 border-r border-staff-line bg-staff-sunken transition-[width] duration-200 ease-out lg:block",
                  collapsed ? "w-14" : "w-60",
                )}
              >
                <aside aria-label="Navigation" className="sticky top-0 flex h-dvh flex-col">
                  <div
                    className={cn(
                      "flex h-13 shrink-0 items-center border-b border-staff-line px-2",
                    )}
                  >
                    <ProductSwitcher current={product} products={products} collapsed={collapsed} />
                  </div>
                  <NavScrollArea>
                    <SidebarNav
                      groups={navGroups}
                      pathname={pathname}
                      Link={Link}
                      collapsed={collapsed}
                    />
                  </NavScrollArea>
                  <div
                    className={cn(
                      "flex shrink-0 border-t border-staff-line p-2",
                      collapsed && "justify-center",
                    )}
                  >
                    <StaffTooltip
                      label={collapsed ? "Expand navigation" : "Collapse navigation"}
                      side="right"
                    >
                      <StaffButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
                        aria-expanded={!collapsed}
                        onClick={toggleCollapsed}
                        className="text-staff-muted"
                      >
                        {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
                      </StaffButton>
                    </StaffTooltip>
                  </div>
                </aside>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-staff-top-bar shrink-0 items-center gap-2 border-b border-staff-line bg-staff-canvas/95 px-3 backdrop-blur-sm supports-[backdrop-filter]:bg-staff-canvas/85 md:gap-3 md:px-6 lg:px-8">
                  <StaffButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Open navigation"
                    onClick={() => setDrawerOpen(true)}
                    className="lg:hidden"
                  >
                    <Menu aria-hidden />
                  </StaffButton>
                  <ProductMark product={product} className="lg:hidden" />
                  <button
                    type="button"
                    onClick={() => setPaletteOpen(true)}
                    aria-label="Search pages and records"
                    aria-keyshortcuts="Meta+K Control+K"
                    className={cn(
                      "staff-focus staff-target flex h-control-sm min-w-0 flex-1 items-center gap-2 rounded-staff-sm border border-staff-line bg-staff-surface px-2.5 text-left text-staff-sm text-staff-subtle shadow-staff-xs transition-colors md:max-w-sm",
                      "hover:border-staff-line-hover hover:text-staff-muted",
                    )}
                  >
                    <Search aria-hidden className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">Search or jump to…</span>
                    <span className="hidden items-center gap-0.5 sm:flex">
                      <Kbd>⌘</Kbd>
                      <Kbd>K</Kbd>
                    </span>
                  </button>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {topBarActions}
                    {account}
                  </div>
                </header>
                <main
                  id="main-content"
                  tabIndex={-1}
                  className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-5 pb-16 outline-none md:px-8 md:pt-6"
                >
                  {children}
                </main>
              </div>
            </div>

            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetContent
                {...STAFF_LAYER}
                side="left"
                overlayClassName="bg-staff-scrim"
                onCloseAutoFocus={returnDrawerFocus}
                className="flex w-72 max-w-[85vw] flex-col gap-0 border-r border-staff-line bg-staff-sunken p-0 [&>button:last-child]:hidden"
              >
                <SheetTitle className="sr-only">{product.name} navigation</SheetTitle>
                <SheetDescription className="sr-only">Pages you can open</SheetDescription>
                <div className="flex h-13 shrink-0 items-center border-b border-staff-line px-2">
                  <ProductSwitcher current={product} products={products} />
                </div>
                <NavScrollArea>
                  <SidebarNav
                    groups={navGroups}
                    pathname={pathname}
                    Link={Link}
                    onNavigate={() => setDrawerOpen(false)}
                  />
                </NavScrollArea>
              </SheetContent>
            </Sheet>

            <CommandPalette
              open={paletteOpen}
              onOpenChange={setPaletteOpen}
              commands={allCommands}
              {...(search ? { search } : {})}
              navigate={guardedNavigate}
            />
          </div>
        </StaffShortcutsProvider>
      </LaxDensityProvider>
    </TooltipProvider>
  );
}
