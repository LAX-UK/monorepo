import { ImpersonationEndWarningListener } from "@/components/admin/impersonation-end-warning-listener";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { AppShell } from "@/components/layout/app-shell";
import { WelcomeBackToast } from "@/components/marketing/welcome-back-toast";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getAdminSubmissionPendingCount } from "@/lib/data/http/submissions.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import {
  DASHBOARD_DENSITY_COOKIE,
  parseDashboardDensityCookie,
} from "@/lib/preferences/dashboard-density-cookie";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const user = await requireAuthenticatedUser({ shell: "staff", loginNext: "/admin" });
  const { impersonation } = await resolveActingContext(user.role);
  const base = metadataForPrivate("Admin");
  if (!impersonation || !canAccessPlatformAdminRoutes(user.role as UserRole)) {
    return {
      ...base,
      title: { default: "Admin", template: "%s · Admin · LAX" },
    };
  }
  const prefix = `[IMPERSONATING ${impersonation.displayName}] `;
  return {
    ...base,
    title: {
      default: `${prefix}Admin`,
      template: `${prefix}%s · Admin · LAX`,
    },
  };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser({ shell: "staff", loginNext: "/admin" });
  const { impersonation } = await resolveActingContext(user.role);

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

  const showImpersonationBanner =
    Boolean(impersonation) && canAccessPlatformAdminRoutes(user.role as UserRole);

  return (
    <div className={showImpersonationBanner ? "pt-14" : undefined}>
      <ImpersonationEndWarningListener />
      {impersonation && showImpersonationBanner ? (
        <ImpersonationBanner
          entityName={impersonation.displayName}
          expiresAtIso={impersonation.expiresAtIso}
        />
      ) : null}
      <AppShell
        user={user}
        shellRole={role}
        pendingSubmissionCount={pendingSubmissionCount}
        cookieDensity={cookieDensity}
      >
        <WelcomeBackToast />
        {children}
      </AppShell>
    </div>
  );
}
