import { DashboardFetchWarningBanner } from "@/components/dashboard/dashboard-fetch-warning-banner";
import { ExportShellClient } from "@/components/exports/export-shell-client";
import { AccountNotice } from "@/components/layout/account-switcher/account-notice";
import { ReadOnlyBoundary } from "@/components/layout/view-as-client/read-only-boundary";
import {
  READ_ONLY_REASON_ID,
  ViewAsClientBanner,
} from "@/components/layout/view-as-client/view-as-client-banner";
import { ViewAsClientProvider } from "@/components/layout/view-as-client/view-as-client-context";
import { WelcomeBackToast } from "@/components/marketing/welcome-back-toast";
import { ClientShell } from "@/components/shell/client-shell";
import { clientAreaRedirectFor } from "@/lib/auth/client-audience";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { loadSellerConnectNavBadge } from "@/lib/connect/load-seller-connect-nav-badge";
import { dashboardSliceFailureMessage } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { deriveActingContext } from "@/lib/legal-entity/derive-acting-context";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { createPendingInvitationsGateway } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { restoreAccountHref } from "@/lib/navigation/account-link";
import {
  ACCOUNT_NOTICE_COOKIE,
  accountNoticeMessage,
  decodeAccountNotice,
} from "@/lib/navigation/account-notice";
import { buildAccountChrome } from "@/lib/navigation/account-switcher-model";
import type { ClientNavScope } from "@/lib/navigation/client-nav-model";
import { resolveClientRequestPath } from "@/lib/navigation/client-request-path.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import {
  DASHBOARD_DENSITY_COOKIE,
  parseDashboardDensityCookie,
} from "@/lib/preferences/dashboard-density-cookie";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { canAccessStaffAdminShell } from "@auction/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  ...metadataForPrivate("Bid"),
  title: { default: "Bid", template: "%s · LAX Bid" },
};

/** Whether a personal account has submitted work to sell; degrades to "no" on failure. */
async function hasPersonalSubmissions(): Promise<boolean> {
  try {
    const c = await getServerDataContainer();
    return (await c.submissions.getSummary()).total > 0;
  } catch {
    return false;
  }
}

export default async function ClientAreaLayout({ children }: { children: ReactNode }) {
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: CLIENT_ROUTES.home });
  if (!canAccessStaffAdminShell(user.role) && user.accountOnboardingComplete === false) {
    redirect(`/onboarding/account?next=${encodeURIComponent(CLIENT_ROUTES.home)}`);
  }
  const actingContext = await resolveActingContext(user.role, user.staffRole ?? null);
  // A new device, or an organisation the person has left: open the account they used last.
  if (actingContext.needsRestore) {
    redirect(restoreAccountHref(await resolveClientRequestPath()));
  }
  const { acting, safeActing } = deriveActingContext({ actingContext, orgModuleEnabled });
  const actingOrganisation = safeActing?.kind === "organisation" ? safeActing : null;

  const [pendingR, hasSubmissions, sellerConnectNavBadge] = await Promise.all([
    orgModuleEnabled
      ? createPendingInvitationsGateway()
          .listMine()
          .then(
            (value) => ({ ok: true as const, value }),
            (reason: unknown) => ({ ok: false as const, reason }),
          )
      : Promise.resolve({ ok: true as const, value: [] }),
    actingOrganisation ? Promise.resolve(false) : hasPersonalSubmissions(),
    loadSellerConnectNavBadge(user.role, user.staffRole ?? null),
  ]);
  const pendingInvites = pendingR.ok ? pendingR.value : [];
  const layoutWarnings: { title: string; message: string }[] = [];
  if (!pendingR.ok) {
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
  const fromUserDensity =
    user.uiPreferences?.density === "compact"
      ? "compact"
      : user.uiPreferences?.density === "comfortable"
        ? "normal"
        : null;
  const cookieDensity =
    fromUserDensity ?? parseDashboardDensityCookie(jar.get(DASHBOARD_DENSITY_COOKIE)?.value);

  const navScope: ClientNavScope = {
    context: actingOrganisation
      ? { kind: "organisation", id: actingOrganisation.id, role: actingOrganisation.role }
      : { kind: "personal" },
    hasSubmissions,
  };
  // Support viewing an account sees that account alone, as its client would.
  const viewingAs = actingContext.impersonation ? actingContext.acting : null;
  // A "view as client" session that ended leaves only the cookie: back to the staff area.
  const staffDestination = viewingAs ? null : clientAreaRedirectFor(user, CLIENT_ROUTES.home);
  if (staffDestination) redirect(staffDestination);
  const account = buildAccountChrome({
    personName:
      viewingAs?.kind === "individual" ? viewingAs.displayName : user.name.trim() || user.email,
    memberships: viewingAs ? [viewingAs] : actingContext.memberships,
    actingId: safeActing?.id ?? null,
    orgModuleEnabled,
    pendingInvitations: pendingInvites.length,
  });

  const noticeMessage = accountNoticeMessage(
    decodeAccountNotice(jar.get(ACCOUNT_NOTICE_COOKIE)?.value),
    (id) => {
      const option = account.switcher?.options.find((o) => o.id === id);
      if (!option) return null;
      return option.kind === "personal" ? "your personal account" : option.name;
    },
  );
  const banners = [
    ...(noticeMessage ? [<AccountNotice key="account-notice" message={noticeMessage} />] : []),
    ...layoutWarnings.map((w) => (
      <DashboardFetchWarningBanner key={w.title} title={w.title} message={w.message} />
    )),
  ];

  const shell = (
    <ViewAsClientProvider viewingAs={viewingAs ? { name: viewingAs.displayName } : null}>
      <ClientShell
        user={user}
        navScope={navScope}
        account={account}
        sellerConnectNavBadge={sellerConnectNavBadge}
        cookieDensity={cookieDensity}
        hideEmailStatusBanner
        acting={acting}
        contextBanner={banners.length > 0 ? <>{banners}</> : undefined}
        topSlot={<WelcomeBackToast />}
      >
        {viewingAs ? (
          <ReadOnlyBoundary reasonId={READ_ONLY_REASON_ID}>{children}</ReadOnlyBoundary>
        ) : (
          children
        )}
      </ClientShell>
    </ViewAsClientProvider>
  );

  return (
    <ExportShellClient>
      {viewingAs ? (
        <div className="[--view-as-client-banner-height:3rem]">
          <ViewAsClientBanner accountName={viewingAs.displayName} />
          {shell}
        </div>
      ) : (
        shell
      )}
    </ExportShellClient>
  );
}
