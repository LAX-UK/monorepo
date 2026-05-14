"use client";

import {
  type StaffNavGroupSpec,
  type StaffNavItemSpec,
  getStaffNavActiveGroupId,
  getStaffNavGroups,
  staffNavItemToAppShellItem,
} from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import type { UserRole, UserStaffRole } from "@auction/types";
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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const LS_PREFIX = "lax.staffNav.open.";

function itemActive(spec: StaffNavItemSpec, pathname: string): boolean {
  const shell = staffNavItemToAppShellItem(spec);
  return shell.match
    ? shell.match(pathname)
    : pathname === spec.href || pathname.startsWith(`${spec.href}/`);
}

function groupBadgeTotal(g: StaffNavGroupSpec): number {
  return g.items.reduce((sum, i) => sum + (i.badge ?? 0), 0);
}

export function StaffSidebarNav({
  user,
  pendingSubmissionCount,
  labelsHidden,
  onNavigate,
}: {
  user: SessionUser;
  pendingSubmissionCount: number;
  labelsHidden: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const role = user.role as UserRole;
  const staffRole = user.staffRole as UserStaffRole | null | undefined;

  const groups = useMemo(
    () => getStaffNavGroups(role, pendingSubmissionCount, staffRole ?? null),
    [role, pendingSubmissionCount, staffRole],
  );

  const activeGroupId = useMemo(
    () => getStaffNavActiveGroupId(pathname, role, staffRole ?? null, pendingSubmissionCount),
    [pathname, role, staffRole, pendingSubmissionCount],
  );

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const readLocalStorage = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const g of groups) {
      try {
        const raw = localStorage.getItem(LS_PREFIX + g.id);
        if (raw === "1") next[g.id] = true;
        else if (raw === "0") next[g.id] = false;
        else next[g.id] = g.id === activeGroupId;
      } catch {
        next[g.id] = g.id === activeGroupId;
      }
    }
    return next;
  }, [groups, activeGroupId]);

  useEffect(() => {
    setOpenMap(readLocalStorage());
  }, [readLocalStorage]);

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenMap((prev) => ({ ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  const persistOpen = (groupId: string, open: boolean) => {
    setOpenMap((prev) => ({ ...prev, [groupId]: open }));
    try {
      localStorage.setItem(LS_PREFIX + groupId, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

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
                <DropdownMenuLabel className="font-label text-xs uppercase tracking-widest">
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
                      <Link href={item.href} {...(onNavigate ? { onClick: onNavigate } : {})}>
                        <Icon className="mr-2 size-4 shrink-0 opacity-70" aria-hidden />
                        <span className="flex-1">{item.label}</span>
                        {item.badge ? (
                          <Badge className="ml-2 rounded-full bg-lot-orange px-1.5 py-0 font-label text-[9px] text-white">
                            {item.badge > 99 ? "99+" : item.badge}
                          </Badge>
                        ) : null}
                      </Link>
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
                <Badge className="rounded-full bg-lot-orange px-1.5 py-0 font-label text-[9px] text-white">
                  {gb > 99 ? "99+" : gb}
                </Badge>
              ) : null}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pl-1 pt-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = itemActive(item, pathname);
                return (
                  <Tooltip key={item.id} delayDuration={400}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        {...(onNavigate ? { onClick: onNavigate } : {})}
                        aria-current={active ? "page" : undefined}
                        aria-label={item.label}
                        className={cn(
                          "group relative flex min-h-10 items-center gap-3 rounded-md px-2 py-2 pl-7 font-label text-[13px] font-medium text-on-surface-variant transition-colors",
                          "hover:bg-surface-container-high hover:text-on-surface",
                          active && "bg-surface-container-high text-on-surface",
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                          {item.label}
                        </span>
                        {item.badge ? (
                          <Badge className="rounded-full bg-lot-orange px-1.5 py-0 font-label text-[9px] text-white">
                            {item.badge > 99 ? "99+" : item.badge}
                          </Badge>
                        ) : null}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="hidden lg:block">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
