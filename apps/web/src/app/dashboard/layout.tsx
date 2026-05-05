import { AppShell } from "@/components/layout/app-shell";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  DASHBOARD_DENSITY_COOKIE,
  parseDashboardDensityCookie,
} from "@/lib/preferences/dashboard-density-cookie";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import {
  CLIENT_WORKSPACE_COOKIE,
  parseClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import {
  type UserRole,
  canAccessPlatformAdminRoutes,
  canAccessStaffAdminShell,
} from "@auction/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  ...metadataForPrivate("Dashboard"),
  title: { default: "Dashboard", template: "%s \u00B7 Dashboard \u00B7 LAX" },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login?next=/dashboard&auth=required");
  }
  const role = user.role as UserRole;
  if (canAccessStaffAdminShell(role)) {
    redirect(canAccessPlatformAdminRoutes(role) ? "/admin" : "/admin/payments");
  }

  const jar = await cookies();
  const clientWorkspaceMode = parseClientWorkspaceMode(jar.get(CLIENT_WORKSPACE_COOKIE)?.value);
  const cookieDensity = parseDashboardDensityCookie(jar.get(DASHBOARD_DENSITY_COOKIE)?.value);

  return (
    <AppShell
      user={user}
      shellRole="client"
      clientWorkspaceMode={clientWorkspaceMode}
      cookieDensity={cookieDensity}
    >
      {children}
    </AppShell>
  );
}
