"use client";

import { WorkspaceModeSwitcher } from "@/components/dashboard/workspace-mode-switcher";
import type { AppShellNavItem } from "@/components/layout/app-shell-nav";
import { openCommandPalette } from "@/components/layout/command-palette-events";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DensityTweakSection } from "@/components/layout/tweaks-popover";
import { MediaImage } from "@/components/ui/media-image";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import type { SessionUser } from "@/lib/data/contracts";
import { formatUnreadTabLabel } from "@/lib/shell/format-unread-tab-label";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { ChevronRight, Compass } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: "client" | "staff";
  items: AppShellNavItem[];
  clientWorkspaceMode?: ClientWorkspaceMode;
  user?: Pick<SessionUser, "name" | "email" | "image"> | null;
};

function navGroupLabel(item: AppShellNavItem, variant: "client" | "staff"): string {
  if (variant === "staff") {
    if (item.href.startsWith("/admin/finance")) return "Finance";
    if (item.href.startsWith("/admin/catalog")) return "Catalog";
    return "Admin";
  }
  if (item.id === "organisations" || item.id === "invitations") return "Organisations";
  if (
    item.id === "notifications" ||
    item.id === "settings" ||
    item.href.includes("/settings") ||
    item.id === "payments"
  ) {
    return "Account";
  }
  if (
    item.href.includes("/seller") ||
    item.id.startsWith("seller") ||
    item.id === "submissions" ||
    item.id === "in-sale" ||
    item.id === "payouts" ||
    item.id === "connect" ||
    item.id === "artist"
  ) {
    return "Workspace";
  }
  return "Workspace";
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

function profileInitials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const fromEmail = email[0] ?? "";
  return (first + second).toUpperCase() || fromEmail.toUpperCase() || "?";
}

function MobileProfileStrip({
  user,
  onNavigate,
}: {
  user: Pick<SessionUser, "name" | "email" | "image">;
  onNavigate: () => void;
}) {
  const displayName = user.name.trim() || user.email;

  return (
    <div className="rounded-lg border border-border-hairline bg-surface-container-low/40 p-4">
      <div className="flex items-center gap-3">
        <MediaImage
          src={user.image ?? null}
          alt={displayName}
          label={profileInitials(user.name, user.email)}
          shape="circle"
          sizes="40px"
          className="size-10 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-on-surface">{displayName}</p>
          <p className="truncate text-xs text-on-surface-variant">{user.email}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary-container/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary-container/20"
        >
          All settings
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
        <Link
          href="/dashboard/settings/profile"
          onClick={onNavigate}
          className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border-hairline px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high"
        >
          Profile
          <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
        </Link>
        <Link
          href="/dashboard/settings/account"
          onClick={onNavigate}
          className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border-hairline px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high"
        >
          Account settings
          <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function MobileMoreSheet({
  open,
  onOpenChange,
  variant,
  items,
  clientWorkspaceMode = "buying",
  user,
}: Props) {
  const pathname = usePathname();
  const { unread } = useUnreadNotifications();
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
          {variant === "client" ? (
            <WorkspaceModeSwitcher mode={clientWorkspaceMode} variant="inline" />
          ) : null}
          {variant === "client" && user ? (
            <MobileProfileStrip user={user} onNavigate={() => onOpenChange(false)} />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              openCommandPalette();
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary-container/15 px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary transition-colors hover:bg-primary-container/25"
          >
            <Compass className="size-4 shrink-0" aria-hidden />
            Quick go
          </Button>
          <p className="text-center text-xs text-on-surface-variant">
            Jump to collection, payments, organisations, and more
          </p>
          {grouped.length > 0 ? (
            <div className="space-y-4">
              {grouped.map(([group, groupItems]) => (
                <div key={group}>
                  <p className="mb-2 font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                    {group}
                  </p>
                  <nav aria-label={`${group} destinations`} className="grid gap-2">
                    {groupItems.map((item) => {
                      const Icon = item.icon;
                      const active = isNavItemActive(pathname, item);
                      const isNotifications = item.id === "notifications";
                      const ariaLabel = isNotifications
                        ? formatUnreadTabLabel(item.label, unread)
                        : item.label;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => onOpenChange(false)}
                          aria-current={active ? "page" : undefined}
                          aria-label={ariaLabel}
                          className={cn(
                            "flex min-h-12 items-center gap-3 rounded-lg border px-4 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] transition-colors",
                            active
                              ? "border-primary/30 bg-primary-container/15 text-primary"
                              : "border-border-hairline bg-surface-container-low/40 text-on-surface hover:bg-surface-container-high",
                          )}
                        >
                          <span className="relative flex shrink-0 items-center">
                            <Icon className="size-4 text-primary" aria-hidden />
                            {isNotifications && unread > 0 ? (
                              <span
                                className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-label text-[10px] font-bold text-on-error"
                                aria-hidden
                              >
                                {unread > 9 ? "9+" : unread}
                              </span>
                            ) : null}
                            {item.badge ? (
                              <span
                                className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 font-label text-[10px] font-bold text-on-warning"
                                aria-hidden
                              >
                                {item.badge > 9 ? "9+" : item.badge}
                              </span>
                            ) : null}
                          </span>
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
