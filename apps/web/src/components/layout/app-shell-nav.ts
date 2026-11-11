import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { getStaffNavItems, getStaffNavParentLabel } from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import { type ClientNavScope, getClientNavItems } from "@/lib/navigation/client-nav-model";
import { type AppShellRole, sessionUserToShellRole } from "@/lib/shell/session-user-shell-role";
import type { UserRole } from "@auction/types";

export type { AppShellRole, AppShellNavItem };
export { sessionUserToShellRole };

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
      : (sessionUser ?? { role: "staff", staffRoles: ["administrator"] });
  const items = getAppShellNavItems(shell, navUser);
  const active = items.find((item) =>
    item.match ? item.match(pathname) : exactOrNested(item.href)(pathname),
  );
  if (active) return active.label;
  if (pathname.includes("/new")) return "New";
  if (pathname.includes("/edit")) return "Edit";
  if (pathname === "/purchases/pay") return "Pay";
  if (pathname === "/purchases/collect") return "Collection";
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
      staffRoles: ["administrator"],
    };
    return getStaffNavParentLabel(pathname, u.role as UserRole, u.staffRoles, 0);
  }
  return null;
}
