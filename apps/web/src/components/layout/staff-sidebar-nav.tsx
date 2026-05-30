"use client";

import { StaffSidebarPinnedRecents } from "@/components/layout/staff-sidebar-pinned-recents";
import { ViewTransitionLink } from "@/components/layout/view-transition-link";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { navBadgeClassName } from "@/lib/layout/nav-badge-classes";
import { readStaffNavGroupOpen, writeStaffNavGroupOpen } from "@/lib/layout/staff-nav-storage";
import type { NavGroup, NavItem } from "@/lib/shell/contracts";
import { getActiveNavGroupId } from "@/lib/shell/nav-adapters";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@auction/ui/components/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function itemActive(item: NavItem, pathname: string): boolean {
  return item.match
    ? item.match(pathname)
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function groupBadgeTotal(g: NavGroup): number {
  return g.items.reduce((sum, i) => sum + (i.badge ?? 0), 0);
}

function buildOpenMap(
  groups: readonly NavGroup[],
  activeGroupId: string | null,
  readStored: boolean,
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const g of groups) {
    const stored = readStored ? readStaffNavGroupOpen(g.id) : null;
    next[g.id] = stored ?? g.id === activeGroupId;
  }
  return next;
}

function NavItemLink({
  item,
  pathname,
  labelsHidden,
  onNavigate,
  indent,
}: {
  item: NavItem;
  pathname: string;
  labelsHidden: boolean;
  onNavigate?: () => void;
  indent?: boolean;
}) {
  const hydrated = useHydrated();
  const Icon = item.icon;
  const active = itemActive(item, pathname);

  const link = (
    <ViewTransitionLink
      href={item.href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "group relative flex min-h-10 items-center gap-3 rounded-md px-2 py-2 font-label text-[13px] font-medium text-on-surface-variant transition-colors",
        labelsHidden && "justify-center px-2",
        indent && "pl-7",
        "hover:bg-surface-container-high hover:text-on-surface",
        active &&
          (indent
            ? "border-l-2 border-accent-brand bg-primary-container/40 pl-[calc(1.75rem-2px)] text-on-primary-container"
            : "bg-surface-container-high text-on-surface"),
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!labelsHidden ? (
        <>
          <span className="min-w-0 flex-1 truncate whitespace-nowrap">{item.label}</span>
          {item.badge ? (
            <Badge className={navBadgeClassName(item.badgeTone)}>
              {item.badge > 99 ? "99+" : item.badge}
            </Badge>
          ) : null}
        </>
      ) : null}
    </ViewTransitionLink>
  );

  if (labelsHidden) return link;

  if (!hydrated) return link;

  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="hidden lg:block">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

/** SSR/hydration-safe nav without Radix Collapsible ids (matches server + first client paint). */
function StaffSidebarNavStatic({
  groups,
  labelsHidden,
  pathname,
  activeGroupId,
  onNavigate,
}: {
  groups: readonly NavGroup[];
  labelsHidden: boolean;
  pathname: string;
  activeGroupId: string | null;
  onNavigate?: () => void;
}) {
  if (labelsHidden) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        {groups.map((g) => {
          const GroupIcon = g.icon;
          const anyActive = g.items.some((i) => itemActive(i, pathname));
          const target = g.items.find((i) => itemActive(i, pathname)) ?? g.items[0];
          if (!target) return null;
          const gb = groupBadgeTotal(g);
          return (
            <ViewTransitionLink
              key={g.id}
              href={target.href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              aria-label={g.title}
              className={cn(
                "relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-md",
                anyActive && "bg-surface-container-high text-on-surface",
              )}
            >
              <GroupIcon className="size-4" aria-hidden />
              {gb > 0 ? (
                <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full px-0.5 font-label text-[8px] leading-none text-white">
                  {gb > 99 ? "99+" : gb}
                </Badge>
              ) : null}
            </ViewTransitionLink>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <StaffSidebarPinnedRecents
        labelsHidden={labelsHidden}
        {...(onNavigate ? { onNavigate } : {})}
      />
      {groups.map((g) => {
        const GroupIcon = g.icon;
        const open = g.id === activeGroupId;
        const gb = groupBadgeTotal(g);
        return (
          <div key={g.id} className="rounded-md">
            <div className="flex w-full min-h-10 items-center gap-2 rounded-md px-3 py-2 font-label text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant">
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
                aria-hidden
              />
              <GroupIcon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">{g.title}</span>
              {gb > 0 ? (
                <Badge className={navBadgeClassName("default")}>{gb > 99 ? "99+" : gb}</Badge>
              ) : null}
            </div>
            {open ? (
              <div className="space-y-0.5 pl-1 pt-0.5">
                {g.items.map((item) => (
                  <NavItemLink
                    key={item.id}
                    item={item}
                    pathname={pathname}
                    labelsHidden={false}
                    {...(onNavigate ? { onNavigate } : {})}
                    indent
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StaffSidebarNavHydrated({
  groups,
  labelsHidden,
  pathname,
  activeGroupId,
  openMap,
  onNavigate,
  persistOpen,
}: {
  groups: readonly NavGroup[];
  labelsHidden: boolean;
  pathname: string;
  activeGroupId: string | null;
  openMap: Record<string, boolean>;
  onNavigate?: () => void;
  persistOpen: (groupId: string, open: boolean) => void;
}) {
  if (labelsHidden) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        {groups.map((g) => {
          const GroupIcon = g.icon;
          const anyActive = g.items.some((i) => itemActive(i, pathname));
          const gb = groupBadgeTotal(g);
          return (
            <DropdownMenu key={g.id}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "relative min-h-10 min-w-10 shrink-0",
                    anyActive && "bg-surface-container-high text-on-surface",
                  )}
                  aria-label={g.title}
                >
                  <GroupIcon className="size-4" aria-hidden />
                  {gb > 0 ? (
                    <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full px-0.5 font-label text-[8px] leading-none text-white">
                      {gb > 99 ? "99+" : gb}
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="min-w-[10rem]">
                <DropdownMenuLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
                  {g.title}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const active = itemActive(item, pathname);
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      asChild
                      className={cn(active && "bg-surface-container-high")}
                    >
                      <ViewTransitionLink
                        href={item.href}
                        {...(onNavigate ? { onClick: onNavigate } : {})}
                      >
                        <Icon className="mr-2 size-4 shrink-0 opacity-70" aria-hidden />
                        <span className="flex-1">{item.label}</span>
                        {item.badge ? (
                          <Badge className={navBadgeClassName(item.badgeTone, "ml-2")}>
                            {item.badge > 99 ? "99+" : item.badge}
                          </Badge>
                        ) : null}
                      </ViewTransitionLink>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <StaffSidebarPinnedRecents
        labelsHidden={labelsHidden}
        {...(onNavigate ? { onNavigate } : {})}
      />
      {groups.map((g) => {
        const GroupIcon = g.icon;
        const open = openMap[g.id] ?? g.id === activeGroupId;
        const gb = groupBadgeTotal(g);
        return (
          <Collapsible key={g.id} open={open} onOpenChange={(next) => persistOpen(g.id, next)}>
            <CollapsibleTrigger
              className={cn(
                "flex w-full min-h-10 items-center gap-2 rounded-md px-3 py-2 font-label text-[12px] font-semibold uppercase tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface",
              )}
            >
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
                aria-hidden
              />
              <GroupIcon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">{g.title}</span>
              {gb > 0 ? (
                <Badge className={navBadgeClassName("default")}>{gb > 99 ? "99+" : gb}</Badge>
              ) : null}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pl-1 pt-0.5">
              {g.items.map((item) => (
                <NavItemLink
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  labelsHidden={false}
                  {...(onNavigate ? { onNavigate } : {})}
                  indent
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

export function StaffSidebarNav({
  groups,
  labelsHidden,
  onNavigate,
}: {
  groups: readonly NavGroup[];
  labelsHidden: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const hydrated = useHydrated();

  const activeGroupId = useMemo(() => getActiveNavGroupId(groups, pathname), [groups, pathname]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() =>
    buildOpenMap(groups, activeGroupId, false),
  );

  useEffect(() => {
    if (!hydrated) return;
    setOpenMap(buildOpenMap(groups, activeGroupId, true));
  }, [hydrated, groups, activeGroupId]);

  useEffect(() => {
    if (!hydrated || !activeGroupId) return;
    setOpenMap((prev) => ({ ...prev, [activeGroupId]: true }));
    writeStaffNavGroupOpen(activeGroupId, true);
  }, [hydrated, activeGroupId]);

  const persistOpen = useCallback((groupId: string, open: boolean) => {
    setOpenMap((prev) => ({ ...prev, [groupId]: open }));
    writeStaffNavGroupOpen(groupId, open);
  }, []);

  if (!hydrated) {
    return (
      <StaffSidebarNavStatic
        groups={groups}
        labelsHidden={labelsHidden}
        pathname={pathname}
        activeGroupId={activeGroupId}
        {...(onNavigate ? { onNavigate } : {})}
      />
    );
  }

  return (
    <StaffSidebarNavHydrated
      groups={groups}
      labelsHidden={labelsHidden}
      pathname={pathname}
      activeGroupId={activeGroupId}
      openMap={openMap}
      persistOpen={persistOpen}
      {...(onNavigate ? { onNavigate } : {})}
    />
  );
}
