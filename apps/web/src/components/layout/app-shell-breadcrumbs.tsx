"use client";

import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
import type { AppShellRole } from "@/components/layout/app-shell-nav";
import { MobileShellTitle } from "@/components/layout/mobile-shell-title";
import type { SessionUser } from "@/lib/data/contracts";
import { buildAdminBreadcrumbTrail } from "@/lib/navigation/admin-breadcrumb-trail";
import { buildClientBreadcrumbTrail } from "@/lib/navigation/client-breadcrumb-trail";
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
    const items = buildClientBreadcrumbTrail(pathname, clientWorkspaceMode);
    return (
      <>
        <div className="min-w-0 flex-1 lg:hidden">
          <MobileShellTitle items={items} />
        </div>
        <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 lg:block lg:flex-none">
          <Breadcrumbs items={items} className="text-xs" inline />
        </nav>
      </>
    );
  }

  const items = buildAdminBreadcrumbTrail(pathname, role, sessionUser, clientWorkspaceMode);

  return (
    <>
      <div className="min-w-0 flex-1 lg:hidden">
        <MobileShellTitle items={items} />
      </div>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 lg:block lg:flex-none">
        <Breadcrumbs items={items} className="text-xs" inline />
      </nav>
    </>
  );
}
