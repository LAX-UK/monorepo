import { startKycVerification } from "@/app/(client)/verify-identity/actions";
import { ConnectLoadFailure } from "@/components/connect/connect-load-failure";
import { PayoutSetupSteps } from "@/components/connect/payout-setup-steps";
import { SellerConnectWorkspace } from "@/components/connect/seller-connect-workspace";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SellerProfileUnavailableAlert } from "@/components/dashboard/seller-profile-unavailable-alert";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import {
  getServerStripeConnectClientConfig,
  getServerStripeConnectStatus,
  syncServerStripeConnectStatus,
} from "@/lib/data/http/stripe-connect.server";
import type { StripeConnectLoadError } from "@/lib/data/http/stripe-connect.types";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { payoutSetupSteps } from "@/lib/presenters/payout-setup-steps";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SellerPayoutSetupPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: DASHBOARD_ROUTES.sellerConnect,
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  const { sellerEntityId, sellingAsOrganisation } = sellerCtx;
  // An organisation's payout setup is one of its settings pages.
  if (sellingAsOrganisation && sellerEntityId) {
    redirect(organisationHref("payouts"));
  }

  const [clientConfig, kycSummary] = await Promise.all([
    getServerStripeConnectClientConfig(),
    getServerKycStatusSummary().catch(() => null),
  ]);
  const kycApproved = kycSummary?.status === "approved";

  let status = null;
  let connectFailure: StripeConnectLoadError | null = null;
  let syncDegraded = false;
  let isLaxManaged = false;
  let memberRole = "owner";
  let entityStatus = "connect_pending";

  if (sellerEntityId) {
    const hub = createOrganisationHubGateway();
    const entity = await hub.getEntityDetail(sellerEntityId).catch(() => null);
    isLaxManaged = entity?.isLaxManaged ?? false;
    entityStatus = entity?.status ?? "connect_pending";
    memberRole = sellerCtx.personalEntity?.role ?? "owner";

    const connectRes = entity?.stripeConnectAccountId
      ? await syncServerStripeConnectStatus(sellerEntityId)
      : await getServerStripeConnectStatus(sellerEntityId);

    if (connectRes.ok) {
      status = connectRes.data;
      syncDegraded = Boolean(connectRes.data.syncDegraded);
    } else if (connectRes.error === "not_connected") {
      status = null;
    } else {
      connectFailure = connectRes.error;
    }
  }

  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-8">
      <DashboardPageHeader
        title="Payout setup"
        {...(sellerEntityId && !connectFailure
          ? { description: "Two steps, both on this page. We pay you when a work sells." }
          : {})}
      />

      {sellerEntityId && !connectFailure ? (
        <PayoutSetupSteps
          steps={payoutSetupSteps("personal", {
            identityChecked: kycApproved,
            payoutsReady: status?.payoutsEnabled ?? false,
          })}
        />
      ) : null}

      {!sellerEntityId ? <SellerProfileUnavailableAlert /> : null}

      {connectFailure ? (
        <ConnectLoadFailure error={connectFailure} />
      ) : sellerEntityId ? (
        <SellerConnectWorkspace
          publishableKey={clientConfig.publishableKey}
          connectEnforced={clientConfig.connectEnforced}
          status={status}
          legalEntityId={sellerEntityId}
          memberRole={memberRole}
          kycApproved={kycApproved}
          kycSummary={kycSummary}
          onStartKyc={startKycVerification}
          isLaxManaged={isLaxManaged}
          entityStatus={entityStatus}
          returnPath={DASHBOARD_ROUTES.sellerConnect}
          showDashboardLink={false}
          syncDegraded={syncDegraded}
        />
      ) : null}

      <p className="font-body text-xs text-on-surface-variant">
        Questions?{" "}
        <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className="text-link underline">
          {SITE_SUPPORT_EMAIL}
        </a>
        {" · "}
        <Link href={DASHBOARD_ROUTES.seller} className="text-link underline">
          Back to Selling
        </Link>
      </p>
    </DashboardPage>
  );
}
