"use client";

import { getAdminNavGroups } from "@/components/layout/admin-nav-groups";
import { useShellContext } from "@/components/layout/dashboard-shell";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useIsLg } from "@/hooks/use-is-lg";
import type { SessionUser } from "@/lib/data/contracts";
import type { UserRole } from "@auction/types";
import { LabelCaps, cn } from "@auction/ui";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@auction/ui/components/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: SessionUser;
  pendingSubmissionCount?: number;
};

function NavLink({
  href,
  label,
  icon: Icon,
  badge,
  active,
  collapsed,
  onNav,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  active: boolean;
  collapsed: boolean;
  onNav: () => void;
}) {
  const inner = (
    <Link
      href={href}
      onClick={onNav}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={`relative flex items-center border-l-4 transition-all ${
        collapsed ? "justify-center px-2 py-3" : "px-4 py-3"
      } text-xs font-medium uppercase tracking-widest ${
        active
          ? "border-lot-orange bg-surface-container-low text-on-surface"
          : "border-transparent text-on-surface hover:bg-surface-container-low/80"
      }`}
    >
      <Icon className={cn("size-5 shrink-0", collapsed ? "" : "mr-3")} aria-hidden />
      {!collapsed ? (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          {badge != null && badge > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 font-label text-[10px] text-on-primary">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </span>
      ) : badge != null && badge > 0 ? (
        <span className="absolute right-1 top-2 rounded-full bg-primary px-1 font-label text-[9px] text-on-primary">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );

  if (collapsed) {
    return (
      <div className="relative">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>{inner}</TooltipTrigger>
          <TooltipContent side="right" className="font-label text-xs uppercase tracking-wide">
            {label}
            {badge != null && badge > 0 ? ` (${badge})` : ""}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }
  return inner;
}

function AdminNavBody({
  user,
  pendingSubmissionCount,
  onNav,
}: {
  user: SessionUser;
  pendingSubmissionCount: number;
  onNav: () => void;
}) {
  const pathname = usePathname();
  const isLg = useIsLg();
  const { desktopSidebarCollapsed } = useShellContext();
  const collapsed = isLg && desktopSidebarCollapsed;
  const groups = getAdminNavGroups(user.role as UserRole, pendingSubmissionCount);

  return (
    <>
      <div className={collapsed ? "p-4" : "p-8"}>
        <Link
          href="/admin"
          onClick={onNav}
          className={`mb-8 block font-headline tracking-tighter text-on-surface ${collapsed ? "text-center text-lg" : "text-xl"}`}
        >
          {collapsed ? "A" : "Admin"}
        </Link>
        {!collapsed ? (
          <>
            <p className="mb-2 font-label text-xs uppercase tracking-widest text-secondary">
              Signed in
            </p>
            <p className="font-body text-sm font-medium text-on-surface">{user.name}</p>
            <p className="mt-1 truncate font-body text-xs text-on-surface-variant">{user.email}</p>
          </>
        ) : null}
        <nav className={collapsed ? "mt-8 space-y-1" : "mt-12 space-y-6"} aria-label="Admin">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed ? (
                <LabelCaps className="mb-2 block text-[0.65rem] text-secondary">
                  {group.title}
                </LabelCaps>
              ) : null}
              <div className="space-y-1">
                {group.items.map((l) => {
                  const active =
                    l.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === l.href || pathname.startsWith(`${l.href}/`);
                  return (
                    <NavLink
                      key={l.href}
                      href={l.href}
                      label={l.label}
                      icon={l.icon}
                      {...(l.badge != null ? { badge: l.badge } : {})}
                      active={active}
                      collapsed={collapsed}
                      onNav={onNav}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
      <div className={`mt-auto space-y-4 ${collapsed ? "p-4" : "p-8"}`}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <span className="font-label text-xs uppercase tracking-widest text-secondary">
              Theme
            </span>
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        )}
        <LogoutButton onBeforeNavigate={onNav} />
        <Link
          href="/"
          onClick={onNav}
          className={`block font-label text-xs uppercase tracking-widest text-primary transition-colors hover:underline ${collapsed ? "text-center" : ""}`}
        >
          {collapsed ? "←" : "Exit to gallery"}
        </Link>
      </div>
    </>
  );
}

export function AdminSidebar({ user, pendingSubmissionCount = 0 }: Props) {
  const { onNavigate, mobileOpen, setMobileOpen } = useShellContext();
  const isLg = useIsLg();
  const onNav = onNavigate;

  const body = (
    <AdminNavBody user={user} pendingSubmissionCount={pendingSubmissionCount} onNav={onNav} />
  );

  return (
    <>
      {isLg ? (
        <aside className="fixed inset-y-0 left-0 z-50 flex h-full w-[var(--sidebar-width)] flex-col border-r border-outline-variant/15 bg-surface-container-lowest shadow-[4px_0_24px_rgba(0,0,0,0.06)] transition-[width] duration-200">
          {body}
        </aside>
      ) : (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="flex w-[min(100vw-2rem,20rem)] max-w-none flex-col border-outline-variant/15 p-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Admin navigation</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col overflow-y-auto">{body}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
