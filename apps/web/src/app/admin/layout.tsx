import { AppShell } from "@/components/layout/app-shell";
import { WelcomeBackToast } from "@/components/marketing/welcome-back-toast";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getAdminSubmissionPendingCount } from "@/lib/data/http/submissions.server";
import {
  DASHBOARD_DENSITY_COOKIE,
  parseDashboardDensityCookie,
} from "@/lib/preferences/dashboard-density-cookie";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  ...metadataForPrivate("Admin"),
  title: { default: "Admin", template: "%s \u00B7 Admin \u00B7 LAX" },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser({ shell: "staff", loginNext: "/admin" });

  let pendingSubmissionCount = 0;
  if (canAccessPlatformAdminRoutes(user.role as UserRole)) {
    try {
      pendingSubmissionCount = await getAdminSubmissionPendingCount();
    } catch {
      pendingSubmissionCount = 0;
    }
  }

  const role = canAccessPlatformAdminRoutes(user.role as UserRole) ? "admin" : "accountant";

  const jar = await cookies();
  const cookieDensity = parseDashboardDensityCookie(jar.get(DASHBOARD_DENSITY_COOKIE)?.value);

  return (
    <AppShell
      user={user}
      shellRole={role}
      pendingSubmissionCount={pendingSubmissionCount}
      cookieDensity={cookieDensity}
    >
      <WelcomeBackToast />
      {children}
    </AppShell>
  );
}
