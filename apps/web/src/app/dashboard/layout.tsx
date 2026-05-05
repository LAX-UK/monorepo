import { AppShell } from "@/components/layout/app-shell";
import { WelcomeBackToast } from "@/components/marketing/welcome-back-toast";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  DASHBOARD_DENSITY_COOKIE,
  parseDashboardDensityCookie,
} from "@/lib/preferences/dashboard-density-cookie";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import {
  CLIENT_WORKSPACE_COOKIE,
  parseClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  ...metadataForPrivate("Dashboard"),
  title: { default: "Dashboard", template: "%s \u00B7 Dashboard \u00B7 LAX" },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/dashboard" });

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
      <WelcomeBackToast />
      {children}
    </AppShell>
  );
}
