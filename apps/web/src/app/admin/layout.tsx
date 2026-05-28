import { AdminShellHeaderActions } from "@/components/admin/admin-shell-header-actions";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { ImpersonationEndWarningListener } from "@/components/admin/impersonation-end-warning-listener";
import { PlatformStaffContextBanners } from "@/components/admin/platform-staff-context-banners";
import { ExportShellClient } from "@/components/exports/export-shell-client";
import { sessionUserToShellRole } from "@/components/layout/app-shell-nav";
import { WelcomeBackToast } from "@/components/marketing/welcome-back-toast";
import { FinanceShell } from "@/components/shell/finance-shell";
import { StaffShell } from "@/components/shell/staff-shell";
import type { ActingContext } from "@/lib/auth/capabilities";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  getAdminNavCounts,
  getFinanceAdminNavCounts,
} from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminArtistStats } from "@/lib/data/http/admin.server";
import { getAdminSubmissionPendingCount } from "@/lib/data/http/submissions.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import {
  DASHBOARD_DENSITY_COOKIE,
  parseDashboardDensityCookie,
} from "@/lib/preferences/dashboard-density-cookie";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import {
  type UserRole,
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  roleHasCapability,
} from "@auction/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const user = await requireAuthenticatedUser({ shell: "staff", loginNext: "/admin" });
  const { impersonation } = await resolveActingContext(user.role, user.staffRole ?? null);
  const base = metadataForPrivate("Admin");
  if (
    !impersonation ||
    !roleHasCapability(user.role as UserRole, "platform.admin.full", user.staffRole ?? null)
  ) {
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
  const { impersonation } = await resolveActingContext(user.role, user.staffRole ?? null);

  let pendingSubmissionCount = 0;
  let pendingArtistCount = 0;
  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  const staffRole = user.staffRole ?? null;
  const userRole = user.role as UserRole;
  if (canAccessPlatformAdminRoutes(userRole, staffRole)) {
    try {
      navCounts = await getAdminNavCounts();
      pendingSubmissionCount = navCounts.submissionsPending;
      pendingArtistCount = navCounts.artistsPending;
    } catch {
      try {
        pendingSubmissionCount = await getAdminSubmissionPendingCount();
      } catch {
        pendingSubmissionCount = 0;
      }
      try {
        const stats = await getAdminArtistStats();
        pendingArtistCount = stats.pendingReview;
      } catch {
        pendingArtistCount = 0;
      }
    }
  } else if (canAccessFinanceAdminRoutes(userRole, staffRole)) {
    try {
      navCounts = await getFinanceAdminNavCounts();
    } catch {
      navCounts = EMPTY_ADMIN_NAV_COUNTS;
    }
  }

  const role = sessionUserToShellRole(user);

  const jar = await cookies();
  const cookieDensity = parseDashboardDensityCookie(jar.get(DASHBOARD_DENSITY_COOKIE)?.value);

  const showImpersonationBanner =
    Boolean(impersonation) &&
    roleHasCapability(user.role as UserRole, "platform.admin.full", user.staffRole ?? null);

  const acting: ActingContext = impersonation
    ? {
        kind: "impersonating",
        userId: "staff-session",
        userName: impersonation.displayName,
      }
    : { kind: "self" };

  const headerRightSlot = (
    <AdminShellHeaderActions
      pendingSubmissionCount={pendingSubmissionCount}
      showPlatformLinks={canAccessPlatformAdminRoutes(
        user.role as UserRole,
        user.staffRole ?? null,
      )}
    />
  );

  return (
    <ExportShellClient>
      <div
        className={
          showImpersonationBanner ? "pt-[var(--impersonation-banner-height,3.5rem)]" : undefined
        }
      >
        <ImpersonationEndWarningListener />
        {impersonation && showImpersonationBanner ? (
          <ImpersonationBanner
            entityName={impersonation.displayName}
            expiresAtIso={impersonation.expiresAtIso}
          />
        ) : null}
        {role === "finance" ? (
          <FinanceShell
            user={user}
            pendingSubmissionCount={pendingSubmissionCount}
            navCounts={navCounts}
            cookieDensity={cookieDensity}
            acting={acting}
            headerRightSlot={headerRightSlot}
            topSlot={<WelcomeBackToast />}
          >
            {children}
          </FinanceShell>
        ) : (
          <StaffShell
            user={user}
            pendingSubmissionCount={pendingSubmissionCount}
            pendingArtistCount={pendingArtistCount}
            navCounts={navCounts}
            cookieDensity={cookieDensity}
            acting={acting}
            headerRightSlot={headerRightSlot}
            contextBanner={<PlatformStaffContextBanners />}
            topSlot={<WelcomeBackToast />}
          >
            {children}
          </StaffShell>
        )}
      </div>
    </ExportShellClient>
  );
}
