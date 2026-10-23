import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { getStaffNavItems, getStaffNavParentLabel } from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import { type ClientNavScope, getClientNavItems } from "@/lib/navigation/client-nav-model";
import { type AppShellRole, sessionUserToShellRole } from "@/lib/shell/session-user-shell-role";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import type { UserRole, UserStaffRole } from "@auction/types";

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

/** Every entry visible, so route labels resolve whatever the viewer may open. */
const LABEL_LOOKUP_SCOPE: ClientNavScope = {
  context: { kind: "personal" },
  orgModuleEnabled: true,
  isOrgMember: true,
};

export { getStaffNavItems };

export function getAppShellNavItems(
  shell: AppShellRole,
  sessionUser: Pick<SessionUser, "role" | "staffRole">,
  pendingSubmissionCount = 0,
  clientWorkspace: ClientWorkspaceMode = "buying",
  pendingArtistCount = 0,
  navCounts?: import("@/lib/data/http/admin-nav-counts.types").AdminNavCounts,
  clientScope: ClientNavScope = LABEL_LOOKUP_SCOPE,
): AppShellNavItem[] {
  if (shell === "client") return getClientNavItems({ ...clientScope, mode: clientWorkspace });
  return getStaffNavItems(
    sessionUser.role as UserRole,
    sessionUser.staffRole ?? null,
    pendingSubmissionCount,
    pendingArtistCount,
    navCounts,
  );
}

export function getRouteLabel(
  pathname: string,
  shell: AppShellRole,
  clientWorkspace: ClientWorkspaceMode = "buying",
  sessionUser?: Pick<SessionUser, "role" | "staffRole"> | null,
): string {
  const navUser: Pick<SessionUser, "role" | "staffRole"> =
    shell === "client"
      ? { role: "client", staffRole: null }
      : (sessionUser ?? { role: "staff", staffRole: "super_admin" });
  const items = getAppShellNavItems(shell, navUser, 0, clientWorkspace);
  const active = items.find((item) =>
    item.match ? item.match(pathname) : exactOrNested(item.href)(pathname),
  );
  if (active) return active.label;
  if (pathname.includes("/new")) return "New";
  if (pathname.includes("/edit")) return "Edit";
  if (pathname.includes("/checkout")) return "Checkout";
  if (shell === "client" && pathname.startsWith("/dashboard/organisations")) return "Organisations";
  if (shell === "client" && pathname.startsWith("/dashboard/invitations")) return "Invitations";
  return "Detail";
}

export function getRouteParentLabel(
  pathname: string,
  shell: AppShellRole,
  clientWorkspace: ClientWorkspaceMode = "buying",
  sessionUser?: Pick<SessionUser, "role" | "staffRole"> | null,
): string | null {
  if (shell === "client" && pathname.startsWith("/dashboard/settings")) return "Bid settings";
  if (shell === "client" && pathname.startsWith("/dashboard/checkout")) return "Purchases";
  if (shell === "client" && pathname.startsWith("/dashboard/seller"))
    return clientWorkspace === "selling" ? "Selling" : null;
  if (shell === "client" && pathname.startsWith("/dashboard/organisations")) return "Organisations";
  if (shell === "client" && pathname.startsWith("/dashboard/invitations")) return "Invitations";
  if (shell !== "client" && pathname.startsWith("/admin")) {
    const u = sessionUser ?? {
      role: "staff" as UserRole,
      staffRole: "super_admin" as UserStaffRole,
    };
    return getStaffNavParentLabel(pathname, u.role as UserRole, u.staffRole ?? null, 0);
  }
  return null;
}
