import { DashboardBannerStack } from "@/components/dashboard/dashboard-banner-stack";
import { DashboardThemeSync } from "@/components/dashboard/dashboard-theme-sync";
import { ActingAsBanner } from "@/components/layout/acting-as-banner";
import { WelcomeBackToast } from "@/components/marketing/welcome-back-toast";
import { ClientShell } from "@/components/shell/client-shell";
import { ContextBanner } from "@/components/shell/context-banner";
import type { ActingContext } from "@/lib/auth/capabilities";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
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
  const [kycSummary, orgOnboardingResume, pendingInvites] = await Promise.all([
    c.kyc.getSummary().catch(() => null),
    c.orgOnboarding.getResume().catch(() => null),
    pendingGw.listMine().catch(() => []),
  ]);

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
      <DashboardThemeSync theme={user.uiPreferences?.theme ?? "system"} />
      {children}
    </ClientShell>
  );
}
