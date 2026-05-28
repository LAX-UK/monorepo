import { startKycVerification } from "@/app/dashboard/verify-identity/actions";
import { ConnectWorkspace } from "@/components/connect/connect-workspace";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import {
  SellerOrgContextBanner,
  SellerProfileUnavailableAlert,
} from "@/components/dashboard/seller-org-context-banner";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { buildSellerConnectFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import {
  getServerStripeConnectClientConfig,
  getServerStripeConnectStatus,
  syncServerStripeConnectStatus,
} from "@/lib/data/http/stripe-connect.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import Link from "next/link";

export default async function SellerStripeConnectPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/seller/connect",
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const { sellerEntityId, orgActingSelected, bootstrapFailed } = sellerCtx;

  const [clientConfig, kycSummary] = await Promise.all([
    getServerStripeConnectClientConfig(),
    getServerKycStatusSummary().catch(() => null),
  ]);

  let status = null;
  let connectFailure = null;
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
      connectFailure = buildSellerConnectFailure(connectRes.error);
    }
  }

  const kycApproved = kycSummary?.status === "approved";

  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-8">
      <DashboardPageHeader
        meta="Selling"
        title="Payout setup"
        description="Complete Stripe Express verification in-app so approved lots can be scheduled once finance enables settlement."
      />

      {orgActingSelected ? <SellerOrgContextBanner /> : null}
      {!sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null}

      {connectFailure ? (
        <DashboardSliceErrorAlert failure={connectFailure} />
      ) : sellerEntityId ? (
        <ConnectWorkspace
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
          returnPath="/dashboard/seller/connect"
          syncDegraded={syncDegraded}
        />
      ) : null}

      <p className="font-body text-xs text-on-surface-variant">
        Questions?{" "}
        <a href="mailto:support@lax.bid" className="text-primary underline">
          support@lax.bid
        </a>
        {" · "}
        <Link href="/dashboard/seller" className="text-primary underline">
          Back to seller workspace
        </Link>
      </p>
    </DashboardPage>
  );
}
