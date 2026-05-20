"use client";

import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import type { SessionUser } from "@/lib/data/contracts";
import { buildAdminBreadcrumbTrail } from "@/lib/navigation/admin-breadcrumb-trail";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { usePathname } from "next/navigation";

export function AppShellBreadcrumbs({
  role,
  sessionUser,
  clientWorkspaceMode = "buying",
}: {
  role: AppShellRole;
  sessionUser: SessionUser;
  clientWorkspaceMode?: ClientWorkspaceMode;
}) {
  const pathname = usePathname();

  if (role === "client") {
    const items =
      pathname === "/dashboard"
        ? [{ label: "Dashboard" }]
        : [
            { label: "Dashboard", href: "/dashboard" },
            { label: pathname.split("/").filter(Boolean).pop() ?? "Page" },
          ];
    return (
      <nav aria-label="Breadcrumb" className="min-w-0">
        <Breadcrumbs items={items} className="text-xs" />
      </nav>
    );
  }

  const items = buildAdminBreadcrumbTrail(pathname, role, sessionUser, clientWorkspaceMode);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <Breadcrumbs items={items} className="text-xs" />
    </nav>
  );
}
