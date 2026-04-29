"use client";

import { dashboardNavGroups } from "@/components/layout/dashboard-nav-groups";
import { useShellContext } from "@/components/layout/dashboard-shell";
import { LogoutButton } from "@/components/layout/logout-button";
import { useIsLg } from "@/hooks/use-is-lg";
import { SITE_SHORT_NAME } from "@/lib/brand";
import type { SessionUser } from "@/lib/data/contracts";
import { LabelCaps, cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@auction/ui/components/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: SessionUser;
};

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNav,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
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
      className={`flex items-center border-l-[3px] transition-colors ${
        collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5"
      } text-xs font-medium uppercase tracking-[0.18em] ${
        active
          ? "border-primary bg-surface-container-low text-on-surface"
          : "border-transparent text-on-surface-variant hover:bg-surface-container-low/70 hover:text-on-surface"
      }`}
    >
      <Icon className={cn("size-5 shrink-0", collapsed ? "" : "mr-3")} aria-hidden />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="font-label text-xs uppercase tracking-wide">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return inner;
}

function DashboardNavBody({ user, onNav }: { user: SessionUser; onNav: () => void }) {
  const pathname = usePathname();
  const isLg = useIsLg();
  const { desktopSidebarCollapsed } = useShellContext();
  const collapsed = isLg && desktopSidebarCollapsed;

  return (
    <>
      <div
        className={cn(
          "rounded-sm border border-outline-variant/20 bg-card",
          collapsed ? "p-3" : "p-5",
        )}
      >
        <div className={collapsed ? "text-center" : ""}>
          <p className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            My account
          </p>
          <p className="mt-2 truncate font-headline text-xl font-semibold text-on-surface">
            {collapsed ? SITE_SHORT_NAME.slice(0, 1) : user.name}
          </p>
          {!collapsed ? (
            <p className="mt-1 truncate text-xs text-on-surface-variant">{user.email}</p>
          ) : null}
        </div>
        <nav className={collapsed ? "mt-5 space-y-1" : "mt-8 space-y-5"} aria-label="Dashboard">
          {dashboardNavGroups.map((group) => (
            <div key={group.title}>
              {!collapsed ? (
                <LabelCaps className="mb-2 block text-[0.62rem] text-on-surface-variant">
                  {group.title}
                </LabelCaps>
              ) : null}
              <div className="space-y-1">
                {group.items.map((l) => {
                  const active =
                    l.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === l.href || pathname.startsWith(`${l.href}/`);
                  return (
                    <NavLink
                      key={l.href}
                      href={l.href}
                      label={l.label}
                      icon={l.icon}
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
      <div className={cn("mt-4 space-y-3", collapsed ? "p-1" : "p-1")}>
        <LogoutButton
          onBeforeNavigate={onNav}
          className="w-full rounded-sm border border-outline-variant/30 bg-transparent font-label text-xs uppercase tracking-[0.18em] text-on-surface hover:bg-surface-container-high"
        />
        <Link
          href="/"
          onClick={onNav}
          className={`block font-label text-xs uppercase tracking-[0.18em] text-on-surface transition-colors hover:underline ${collapsed ? "text-center" : ""}`}
        >
          {collapsed ? "←" : "Back to gallery"}
        </Link>
      </div>
    </>
  );
}

export function DashboardSidebar({ user }: Props) {
  const { onNavigate, mobileOpen, setMobileOpen } = useShellContext();
  const isLg = useIsLg();
  const onNav = onNavigate;

  const body = <DashboardNavBody user={user} onNav={onNav} />;

  return (
    <>
      {isLg ? (
        <aside className="sticky top-[calc(var(--header-height,7rem)+1rem)] flex h-fit w-full flex-col transition-[width] duration-200">
          {body}
        </aside>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            className="mb-4 inline-flex min-h-11 w-full justify-center border-outline-variant/30 bg-card text-on-surface"
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
            aria-label="Open account navigation"
          >
            <Menu className="mr-2 size-4" aria-hidden />
            Account menu
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent
              side="left"
              className="flex w-[min(100vw-1.5rem,20rem)] max-w-none flex-col border-outline-variant/20 bg-card p-4"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Dashboard navigation</SheetTitle>
              </SheetHeader>
              <div className="flex h-full flex-col overflow-y-auto">{body}</div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </>
  );
}
