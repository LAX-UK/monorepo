import { DashboardBannerStack } from "@/components/dashboard/dashboard-banner-stack";
import { DashboardFetchWarningBanner } from "@/components/dashboard/dashboard-fetch-warning-banner";
import { ActingAsBanner } from "@/components/layout/acting-as-banner";
import { WelcomeBackToast } from "@/components/marketing/welcome-back-toast";
import { ClientShell } from "@/components/shell/client-shell";
import { ContextBanner } from "@/components/shell/context-banner";
import type { ActingContext } from "@/lib/auth/capabilities";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { dashboardSliceFailureMessage } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { createPendingInvitationsGateway } from "@/lib/legal-entity/pending-invitations.gateway.server";
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
  const actingContext = await resolveActingContext(user.role, user.staffRole ?? null);
  const c = await getServerDataContainer();
  const pendingGw = createPendingInvitationsGateway();
  const [kycR, orgR, pendingR] = await Promise.allSettled([
    c.kyc.getSummary(),
    c.orgOnboarding.getResume(),
    pendingGw.listMine(),
  ]);
  const kycSummary = kycR.status === "fulfilled" ? kycR.value : null;
  const orgOnboardingResume = orgR.status === "fulfilled" ? orgR.value : null;
  const pendingInvites = pendingR.status === "fulfilled" ? pendingR.value : [];
  const layoutWarnings: { title: string; message: string }[] = [];
  if (kycR.status === "rejected") {
    layoutWarnings.push({
      title: "Verification status unavailable",
      message: dashboardSliceFailureMessage(kycR.reason, "kyc", "Could not load KYC status."),
    });
  }
  if (orgR.status === "rejected") {
    layoutWarnings.push({
      title: "Organisation onboarding unavailable",
      message: dashboardSliceFailureMessage(
        orgR.reason,
        "orgOnboarding",
        "Could not load organisation onboarding.",
      ),
    });
  }
  if (pendingR.status === "rejected") {
    layoutWarnings.push({
      title: "Pending invitations unavailable",
      message: dashboardSliceFailureMessage(
        pendingR.reason,
        "invitations",
        "Could not load pending invitations.",
      ),
    });
  }

  const jar = await cookies();
  const clientWorkspaceMode = parseClientWorkspaceMode(jar.get(CLIENT_WORKSPACE_COOKIE)?.value);
  const fromUserDensity =
    user.uiPreferences?.density === "compact"
      ? "compact"
      : user.uiPreferences?.density === "comfortable"
        ? "normal"
        : null;
  const cookieDensity =
    fromUserDensity ?? parseDashboardDensityCookie(jar.get(DASHBOARD_DENSITY_COOKIE)?.value);

  const acting: ActingContext =
    actingContext.impersonation && actingContext.acting
      ? {
          kind: "impersonating",
          userId: actingContext.acting.id,
          userName: actingContext.impersonation.displayName,
        }
      : actingContext.acting?.kind === "organisation"
        ? {
            kind: "organisation",
            orgId: actingContext.acting.id,
            orgName: actingContext.acting.displayName,
          }
        : { kind: "self" };

  return (
    <ClientShell
      user={user}
      clientWorkspaceMode={clientWorkspaceMode}
      cookieDensity={cookieDensity}
      hideEmailStatusBanner
      acting={acting}
      headerRightSlot={
        <ActingAsBanner
          hasSeenTooltip={user.hasSeenActingContextTooltip ?? true}
          userRole={user.role}
          userStaffRole={user.staffRole ?? null}
          prefetchedActingContext={actingContext}
          pendingInvitesCount={pendingInvites.length}
        />
      }
      contextBanner={
        <>
          <ContextBanner acting={acting} />
          {layoutWarnings.map((w) => (
            <DashboardFetchWarningBanner key={w.title} title={w.title} message={w.message} />
          ))}
          <DashboardBannerStack
            user={user}
            acting={actingContext.acting}
            kycSummary={kycSummary}
            orgOnboardingResume={orgOnboardingResume}
          />
        </>
      }
      topSlot={<WelcomeBackToast />}
    >
      {children}
    </ClientShell>
  );
}
