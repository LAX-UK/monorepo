"use client";

import { WorkspaceModeSwitcher } from "@/components/dashboard/workspace-mode-switcher";
import {
  type AppShellRole,
  appShellRoleMeta,
  getAppShellNavItems,
} from "@/components/layout/app-shell-nav";
import { LaxLogo } from "@/components/layout/lax-logo";
import { LogoutButton } from "@/components/layout/logout-button";
import { useSidebarState } from "@/components/layout/sidebar-state";
import { MediaImage } from "@/components/ui/media-image";
import { useLogout } from "@/lib/auth/use-logout";
import { SITE_LOGO_PATH, SITE_LOGO_SHORT_PATH } from "@/lib/brand";
import type { SessionUser } from "@/lib/data/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { Globe2, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: SessionUser;
  role: AppShellRole;
  pendingSubmissionCount?: number;
  onNavigate?: () => void;
  collapsible?: boolean;
  /** Collector vs seller workspace (client shell only). */
  clientWorkspaceMode?: ClientWorkspaceMode;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function CompactLogoutButton({
  onNavigate,
  collapsed,
}: { onNavigate?: () => void; collapsed: boolean }) {
  const { logout, pending } = useLogout(onNavigate ? { onBeforeNavigate: onNavigate } : undefined);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => void logout()}
      className={cn(
        "min-h-10 min-w-10 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        collapsed ? "inline-flex" : "hidden",
      )}
      aria-label={pending ? "Signing out" : "Log out"}
    >
      <LogOut className="size-4" aria-hidden />
    </Button>
  );
}

export function AppShellSidebar({
  user,
  role,
  pendingSubmissionCount = 0,
  onNavigate,
  collapsible = false,
  clientWorkspaceMode = "buying",
}: Props) {
  const pathname = usePathname();
  const meta = appShellRoleMeta[role];
  const items = getAppShellNavItems(role, pendingSubmissionCount, clientWorkspaceMode);
  const { collapsed, peeking } = useSidebarState();
  const labelsHidden = collapsible && collapsed && !peeking;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-container-lowest">
      <div className={cn("border-b border-outline-variant/30 px-3 py-5", !labelsHidden && "px-5")}>
        <Link
          href={role === "client" ? "/dashboard" : "/admin"}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2",
            !labelsHidden && "justify-start",
          )}
          aria-label="LAX dashboard home"
        >
          <LaxLogo
            variant="header"
            imageSrc={labelsHidden ? SITE_LOGO_SHORT_PATH : SITE_LOGO_PATH}
            imageWidth={labelsHidden ? 172 : 430}
            imageHeight={labelsHidden ? 201 : 202}
            className={cn(labelsHidden ? "max-h-9 w-auto max-w-none" : "max-w-[128px]")}
          />
          <span className="size-1.5 rounded-full bg-accent-gold" aria-hidden />
        </Link>
        <div
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border px-2 py-1",
            !labelsHidden && "w-auto justify-start px-3",
            meta.pillClassName,
          )}
        >
          <span className={cn("size-1.5 rounded-full", meta.dotClassName)} aria-hidden />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap font-label text-[10px] font-bold uppercase tracking-[0.12em] transition-[max-width,opacity] duration-150",
              labelsHidden ? "max-w-0 opacity-0" : "max-w-32 opacity-100",
            )}
            aria-hidden={labelsHidden}
          >
            {meta.label}
          </span>
        </div>
      </div>

      <nav
        className={cn("min-h-0 flex-1 overflow-y-auto px-2 py-3", !labelsHidden && "px-3")}
        aria-label={`${meta.label} dashboard`}
      >
        <div className="space-y-1">
          {items.map((item) => {
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
                      "group relative flex min-h-10 items-center justify-center gap-3 rounded-md px-2 py-2 font-label text-[13px] font-medium text-on-surface-variant transition-colors",
                      !labelsHidden && "justify-start px-3",
                      "hover:bg-surface-container-high hover:text-on-surface",
                      active && "bg-surface-container-high text-on-surface",
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
                          "rounded-full bg-lot-orange px-1.5 py-0 font-label text-[9px] text-white",
                          labelsHidden && "absolute right-1 top-1",
                        )}
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
      </nav>

      <div className="border-t border-outline-variant/30 p-3">
        <div
          className={cn(
            "mb-3 flex min-w-0 items-center justify-center gap-3",
            !labelsHidden && "justify-start",
          )}
        >
          <MediaImage
            src={user.image ?? null}
            alt={user.name}
            label={initials(user.name)}
            shape="circle"
            sizes="32px"
            className="size-8 shrink-0"
          />
          <div
            className={cn(
              "min-w-0 overflow-hidden transition-[max-width,opacity] duration-150",
              labelsHidden ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100",
            )}
            aria-hidden={labelsHidden}
          >
            <p className="truncate text-xs font-semibold text-on-surface">{user.name}</p>
            <p className="truncate text-[10px] text-on-surface-variant">{user.email}</p>
          </div>
        </div>
        {role === "client" ? (
          <div className={cn("mb-3 px-0", labelsHidden && "hidden")}>
            <WorkspaceModeSwitcher mode={clientWorkspaceMode} />
          </div>
        ) : null}
        <div className={cn("items-center gap-1", labelsHidden ? "flex justify-center" : "hidden")}>
          {role === "client" ? (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  {...(onNavigate ? { onClick: onNavigate } : {})}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label="Browse LAX.bid"
                >
                  <Globe2 className="size-4" aria-hidden />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="hidden lg:block">
                Browse LAX.bid
              </TooltipContent>
            </Tooltip>
          ) : null}
          <CompactLogoutButton {...(onNavigate ? { onNavigate } : {})} collapsed={labelsHidden} />
        </div>
        {role === "client" && !labelsHidden ? (
          <Link
            href="/"
            {...(onNavigate ? { onClick: onNavigate } : {})}
            className="mb-2 flex min-h-10 items-center gap-2 rounded-md px-3 font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Browse LAX.bid"
          >
            <Globe2 className="size-4 shrink-0" aria-hidden />
            <span>Browse LAX.bid</span>
          </Link>
        ) : null}
        <LogoutButton
          {...(onNavigate ? { onBeforeNavigate: onNavigate } : {})}
          className={cn(
            "mt-2 min-h-9 w-full justify-start rounded-md px-3 font-label text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            labelsHidden && "hidden",
          )}
        />
      </div>
    </div>
  );
}
