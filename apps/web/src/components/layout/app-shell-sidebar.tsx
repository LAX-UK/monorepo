"use client";

import {
  type AppShellRole,
  appShellRoleMeta,
  getAppShellNavItems,
} from "@/components/layout/app-shell-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { useLogout } from "@/lib/auth/use-logout";
import type { SessionUser } from "@/lib/data/contracts";
import { cn } from "@auction/ui";
import { Avatar, AvatarFallback } from "@auction/ui/components/avatar";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: SessionUser;
  role: AppShellRole;
  pendingSubmissionCount?: number;
  onNavigate?: () => void;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function CompactLogoutButton({ onNavigate }: { onNavigate?: () => void }) {
  const { logout, pending } = useLogout(onNavigate ? { onBeforeNavigate: onNavigate } : undefined);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => void logout()}
      className="hidden min-h-10 min-w-10 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface lg:inline-flex xl:hidden"
      aria-label={pending ? "Signing out" : "Log out"}
    >
      <LogOut className="size-4" aria-hidden />
    </Button>
  );
}

export function AppShellSidebar({ user, role, pendingSubmissionCount = 0, onNavigate }: Props) {
  const pathname = usePathname();
  const meta = appShellRoleMeta[role];
  const items = getAppShellNavItems(role, pendingSubmissionCount);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-container-lowest">
      <div className="border-b border-outline-variant/30 px-3 py-5 xl:px-5">
        <Link
          href={role === "client" ? "/dashboard" : "/admin"}
          className="inline-flex w-full items-center justify-center gap-2 xl:justify-start"
          aria-label="LAX dashboard home"
        >
          <span className="font-label text-lg font-bold uppercase tracking-[0.15em] text-on-surface">
            LAX
          </span>
          <span className="size-1.5 rounded-full bg-accent-gold" aria-hidden />
        </Link>
        <div
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border px-2 py-1 xl:w-auto xl:justify-start xl:px-3",
            meta.pillClassName,
          )}
        >
          <span className={cn("size-1.5 rounded-full", meta.dotClassName)} aria-hidden />
          <span className="hidden font-label text-[10px] font-bold uppercase tracking-[0.12em] xl:inline">
            {meta.label}
          </span>
        </div>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2 py-3 xl:px-3"
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
                      "group relative flex min-h-10 items-center justify-center gap-3 rounded-md px-2 py-2 font-label text-[13px] font-medium text-on-surface-variant transition-colors xl:justify-start xl:px-3",
                      "hover:bg-surface-container-high hover:text-on-surface",
                      active && "bg-surface-container-high text-on-surface",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="hidden min-w-0 flex-1 truncate xl:inline">{item.label}</span>
                    {item.badge ? (
                      <Badge className="absolute right-1 top-1 rounded-full bg-lot-orange px-1.5 py-0 font-label text-[9px] text-white xl:static">
                        {item.badge > 99 ? "99+" : item.badge}
                      </Badge>
                    ) : null}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="hidden lg:block xl:hidden">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-outline-variant/30 p-3">
        <div className="mb-3 flex min-w-0 items-center justify-center gap-3 xl:justify-start">
          <Avatar className="size-8 bg-primary text-on-primary">
            <AvatarFallback className="bg-primary font-label text-xs font-bold text-on-primary">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 xl:block">
            <p className="truncate text-xs font-semibold text-on-surface">{user.name}</p>
            <p className="truncate text-[10px] text-on-surface-variant">{user.email}</p>
          </div>
        </div>
        <CompactLogoutButton {...(onNavigate ? { onNavigate } : {})} />
        <LogoutButton
          {...(onNavigate ? { onBeforeNavigate: onNavigate } : {})}
          className="hidden min-h-9 w-full justify-start rounded-md px-3 font-label text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface xl:inline-flex"
        />
      </div>
    </div>
  );
}
