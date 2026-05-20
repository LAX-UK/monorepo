import type { BreadcrumbItem } from "@/components/dashboard/primitives/breadcrumbs";
import {
  type AppShellRole,
  getRouteLabel,
  getRouteParentLabel,
} from "@/components/layout/app-shell-nav";
import type { SessionUser } from "@/lib/data/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";

/** Build href trail segments from pathname for staff admin. */
export function buildAdminBreadcrumbTrail(
  pathname: string,
  role: AppShellRole,
  sessionUser: SessionUser,
  clientWorkspaceMode: ClientWorkspaceMode = "buying",
): BreadcrumbItem[] {
  const workspaceHref = role === "finance" ? "/admin/payments" : "/admin";
  const workspaceLabel = role === "finance" ? "Finance" : "Admin";
  const parent = getRouteParentLabel(pathname, role, clientWorkspaceMode, sessionUser);
  const current = getRouteLabel(pathname, role, clientWorkspaceMode, sessionUser);

  const items: BreadcrumbItem[] = [{ label: workspaceLabel, href: workspaceHref }];

  if (parent && parent !== current) {
    const parentHref = inferParentHref(pathname, role);
    if (parentHref) {
      items.push({ label: parent, href: parentHref });
    } else {
      items.push({ label: parent });
    }
  }

  if (current && current !== workspaceLabel) {
    items.push({ label: current });
  }

  return items;
}

function inferParentHref(pathname: string, role: AppShellRole): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return undefined;
  if (segments[0] !== "admin") return undefined;
  if (segments.length >= 3 && segments[2] !== "new" && segments[2] !== "edit") {
    return `/admin/${segments[1]}`;
  }
  if (role === "finance" && segments[1] === "payments") {
    return "/admin/payments";
  }
  return `/admin/${segments[1]}`;
}
