"use client";

import { WorkspaceModeSwitcher } from "@/components/dashboard/workspace-mode-switcher";
import type { AppShellNavItem } from "@/components/layout/app-shell-nav";
import { openCommandPalette } from "@/components/layout/command-palette-events";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DensityTweakSection } from "@/components/layout/tweaks-popover";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import { Compass } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: "client" | "staff";
  items: AppShellNavItem[];
  clientWorkspaceMode?: ClientWorkspaceMode;
};

function navGroupLabel(item: AppShellNavItem, variant: "client" | "staff"): string {
  if (variant === "staff") {
    if (item.href.startsWith("/admin/finance")) return "Finance";
    if (item.href.startsWith("/admin/catalog")) return "Catalog";
    return "Admin";
  }
  if (
    item.href.includes("/seller") ||
    item.id.startsWith("seller") ||
    item.id === "submissions" ||
    item.id === "in-sale" ||
    item.id === "payouts" ||
    item.id === "artist"
  ) {
    return "Selling";
  }
  if (item.href.includes("/settings")) return "Settings";
  if (item.id === "organisations" || item.id === "invitations") return "Account";
  return "Collection";
}

function groupNavItems(items: AppShellNavItem[], variant: "client" | "staff") {
  const groups = new Map<string, AppShellNavItem[]>();
  for (const item of items) {
    const label = navGroupLabel(item, variant);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return [...groups.entries()];
}

function isNavItemActive(pathname: string, item: AppShellNavItem): boolean {
  if (item.match) return item.match(pathname);
  if (item.href === "/dashboard") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function MobileMoreSheet({
  open,
  onOpenChange,
  variant,
  items,
  clientWorkspaceMode = "buying",
}: Props) {
  const pathname = usePathname();
  const grouped = groupNavItems(items, variant);

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="border-outline-variant bg-surface-container-lowest">
        <BottomSheetHeader className="px-6 pt-2 pb-1 text-left">
          <BottomSheetTitle className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            More
          </BottomSheetTitle>
        </BottomSheetHeader>
        <div className="space-y-5 px-6 pt-4 pb-6">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              openCommandPalette();
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary-container/15 px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary transition-colors hover:bg-primary-container/25"
          >
            <Compass className="size-4 shrink-0" aria-hidden />
            Quick go
          </button>
          <p className="text-center text-xs text-on-surface-variant">
            Jump to settings, payments, organisations, and more
          </p>
          {variant === "client" ? (
            <WorkspaceModeSwitcher mode={clientWorkspaceMode} variant="inline" />
          ) : null}
          {grouped.length > 0 ? (
            <div className="space-y-4">
              {grouped.map(([group, groupItems]) => (
                <div key={group}>
                  <p className="mb-2 font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                    {group}
                  </p>
                  <nav aria-label={`${group} destinations`} className="grid gap-2">
                    {groupItems.map((item) => {
                      const Icon = item.icon;
                      const active = isNavItemActive(pathname, item);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => onOpenChange(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-12 items-center gap-3 rounded-lg border px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] transition-colors",
                            active
                              ? "border-primary/30 bg-primary-container/15 text-primary"
                              : "border-border-hairline bg-surface-container-low/40 text-on-surface hover:bg-surface-container-high",
                          )}
                        >
                          <Icon className="size-4 text-primary" aria-hidden />
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
          ) : null}
          <div className="rounded-lg border border-border-hairline bg-surface-container-low/40 p-4">
            <DensityTweakSection />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border-hairline bg-surface-container-low/40 p-4">
            <div>
              <p className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                Dark mode
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">Toggle the colour scheme.</p>
            </div>
            <ThemeToggle />
          </div>
          <LogoutButton className="min-h-11 w-full justify-center rounded-md border border-border-hairline px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:bg-surface-container-high" />
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
