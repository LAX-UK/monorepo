import { DashboardFetchWarningBanner } from "@/components/dashboard/dashboard-fetch-warning-banner";
import { ExportShellClient } from "@/components/exports/export-shell-client";
import { AccountChangedElsewhere } from "@/components/layout/account-switcher/account-changed-elsewhere";
import { AccountNotice } from "@/components/layout/account-switcher/account-notice";
import { BidSiteChrome } from "@/components/layout/bid-site-chrome";
import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { ReadOnlyBoundary } from "@/components/layout/view-as-client/read-only-boundary";
import {
  READ_ONLY_REASON_ID,
  ViewAsClientBanner,
} from "@/components/layout/view-as-client/view-as-client-banner";
import { ViewAsClientProvider } from "@/components/layout/view-as-client/view-as-client-context";
import { WelcomeBackToast } from "@/components/marketing/welcome-back-toast";
import { AccountsUnavailableFrame } from "@/components/shell/accounts-unavailable-frame";
import { ClientShell } from "@/components/shell/client-shell";
import { ClientWebsiteFrame } from "@/components/shell/client-website-frame";
import { clientAreaRedirectFor } from "@/lib/auth/client-audience";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { dashboardSliceFailureMessage } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerNeedsYouCounts } from "@/lib/data/http/needs-you.server";
import { loadBidFamilyLinks } from "@/lib/ecosystem/product-directory.server";
import { lookupActingContext } from "@/lib/legal-entity/acting-context.server";
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
import { chooseClientLayout } from "@/lib/navigation/client-layout";
import { clientNavScopeFor } from "@/lib/navigation/client-nav-scope";
import { resolveClientRequestPath } from "@/lib/navigation/client-request-path.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { navCountsFrom } from "@/lib/workspace/needs-you-counts";
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
  const lookup = await lookupActingContext(user.role, user.staffRoles);
  // The accounts could not be read: say so, and never fall back to the personal account.
  if (!lookup.ok) return <AccountsUnavailableFrame />;
  const actingContext = lookup.context;
  // A new device, or an organisation the person has left: open the account they used last.
  if (actingContext.needsRestore) {
    redirect(restoreAccountHref(await resolveClientRequestPath()));
  }
  const { acting, safeActing } = deriveActingContext({ actingContext, orgModuleEnabled });
  const actingOrganisation = safeActing?.kind === "organisation" ? safeActing : null;

  const [pendingR, hasSubmissions, needsYouCounts] = await Promise.all([
    orgModuleEnabled
      ? createPendingInvitationsGateway()
          .listMine()
          .then(
            (value) => ({ ok: true as const, value }),
            (reason: unknown) => ({ ok: false as const, reason }),
          )
      : Promise.resolve({ ok: true as const, value: [] }),
    actingOrganisation ? Promise.resolve(false) : hasPersonalSubmissions(),
    // The menu's counts come from the one Needs-you reader Home reads.
    actingOrganisation ? getServerNeedsYouCounts(actingOrganisation.id) : Promise.resolve(null),
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

  const navScope = clientNavScopeFor(actingOrganisation, hasSubmissions);
  const layout = chooseClientLayout(navScope.context);
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
    ...(noticeMessage ? [<AccountNotice key={noticeMessage} message={noticeMessage} />] : []),
    ...layoutWarnings.map((w) => (
      <DashboardFetchWarningBanner key={w.title} title={w.title} message={w.message} />
    )),
  ];

  const page = viewingAs ? (
    <ReadOnlyBoundary reasonId={READ_ONLY_REASON_ID}>{children}</ReadOnlyBoundary>
  ) : (
    <>
      <AccountChangedElsewhere renderedAccountId={safeActing?.id ?? null} />
      {children}
    </>
  );
  const banner = banners.length > 0 ? <>{banners}</> : undefined;

  const shell = (
    <ViewAsClientProvider viewingAs={viewingAs ? { name: viewingAs.displayName } : null}>
      {layout === "website" ? (
        <BidSiteChrome
          wrap={(content) => (
            <>
              <CommandPaletteLazy variant="marketing" />
              {content}
            </>
          )}
        >
          <WelcomeBackToast />
          <ClientWebsiteFrame
            user={user}
            navScope={navScope}
            account={account}
            acting={acting}
            banner={banner}
          >
            {page}
          </ClientWebsiteFrame>
        </BidSiteChrome>
      ) : (
        <ClientShell
          user={user}
          navScope={navScope}
          account={account}
          familyLinks={loadBidFamilyLinks()}
          needsYou={navCountsFrom(needsYouCounts)}
          acting={acting}
          contextBanner={banner}
          topSlot={<WelcomeBackToast />}
        >
          {page}
        </ClientShell>
      )}
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
