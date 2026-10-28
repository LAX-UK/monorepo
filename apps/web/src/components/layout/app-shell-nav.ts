import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { getStaffNavItems, getStaffNavParentLabel } from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import { type ClientNavScope, getClientNavItems } from "@/lib/navigation/client-nav-model";
import { type AppShellRole, sessionUserToShellRole } from "@/lib/shell/session-user-shell-role";
import type { UserRole } from "@auction/types";

export type { AppShellRole, AppShellNavItem };
export { sessionUserToShellRole };

export type AppShellRoleMeta = {
  label: string;
  workspaceLabel: string;
  dotClassName: string;
  pillClassName: string;
};

export const appShellRoleMeta: Record<AppShellRole, AppShellRoleMeta> = {
  client: {
    label: "Client",
    workspaceLabel: "Client",
    dotClassName: "bg-accent-gold",
    pillClassName: "border-accent-gold/40 bg-accent-gold/15 text-secondary dark:text-accent-gold",
  },
  platform: {
    label: "Staff",
    workspaceLabel: "Admin",
    dotClassName: "bg-blue-500",
    pillClassName: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  finance: {
    label: "Finance",
    workspaceLabel: "Finance",
    dotClassName: "bg-emerald-500",
    pillClassName: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

function exactOrNested(href: string) {
  return (pathname: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Every entry an organisation owner sees, so route labels resolve whatever the viewer may open. */
const LABEL_LOOKUP_SCOPE: ClientNavScope = {
  context: { kind: "organisation", id: "", role: "owner" },
  hasSubmissions: true,
};

export { getStaffNavItems };

export function getAppShellNavItems(
  shell: AppShellRole,
  sessionUser: Pick<SessionUser, "role" | "staffRoles">,
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts?: import("@/lib/data/http/admin-nav-counts.types").AdminNavCounts,
  clientScope: ClientNavScope = LABEL_LOOKUP_SCOPE,
): AppShellNavItem[] {
  if (shell === "client") return getClientNavItems(clientScope);
  return getStaffNavItems(
    sessionUser.role as UserRole,
    sessionUser.staffRoles,
    pendingSubmissionCount,
    pendingArtistCount,
    navCounts,
  );
}

export function getRouteLabel(
  pathname: string,
  shell: AppShellRole,
  sessionUser?: Pick<SessionUser, "role" | "staffRoles"> | null,
): string {
  const navUser: Pick<SessionUser, "role" | "staffRoles"> =
    shell === "client"
      ? { role: "client", staffRoles: [] }
      : (sessionUser ?? { role: "staff", staffRoles: ["super_admin"] });
  const items = getAppShellNavItems(shell, navUser);
  const active = items.find((item) =>
    item.match ? item.match(pathname) : exactOrNested(item.href)(pathname),
  );
  if (active) return active.label;
  if (pathname.includes("/new")) return "New";
  if (pathname.includes("/edit")) return "Edit";
  if (pathname.includes("/checkout")) return "Checkout";
  return "Detail";
}

export function getRouteParentLabel(
  pathname: string,
  shell: AppShellRole,
  sessionUser?: Pick<SessionUser, "role" | "staffRoles"> | null,
): string | null {
  if (shell !== "client" && pathname.startsWith("/admin")) {
    const u = sessionUser ?? {
      role: "staff" as UserRole,
      staffRoles: ["super_admin"],
    };
    return getStaffNavParentLabel(pathname, u.role as UserRole, u.staffRoles, 0);
  }
  return null;
}
