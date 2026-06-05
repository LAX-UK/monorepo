import { ConnectWorkspace } from "@/components/connect/connect-workspace";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { OrgTabSectionHeader } from "@/components/organisations/org-tab-section-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { buildSellerConnectFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import {
  getServerStripeConnectClientConfig,
  syncServerStripeConnectStatus,
} from "@/lib/data/http/stripe-connect.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { SectionHeader } from "@auction/ui/components/section-header";
import { notFound } from "next/navigation";

export default async function OrganisationConnectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/organisations/${id}/connect`,
  });
  const ctx = await createPerOrgGateway().getContext(id);
  if (!ctx) notFound();
  const { member, entity } = ctx;

  const [clientConfig, connectRes] = await Promise.all([
    getServerStripeConnectClientConfig(),
    syncServerStripeConnectStatus(id),
  ]);

  const connectFailure =
    connectRes.ok || connectRes.error === "not_connected"
      ? null
      : buildSellerConnectFailure(connectRes.error);

  return (
    <div className="space-y-6">
      <OrgTabSectionHeader>
        <SectionHeader
          kicker={<LabelCaps>Payouts</LabelCaps>}
          heading={<DisplayHeading as="h2">Payout setup</DisplayHeading>}
        />
      </OrgTabSectionHeader>
      <p className="font-body text-sm text-on-surface-variant">
        Manage bank details and verification without leaving LAX.
      </p>
      {connectFailure ? (
        <DashboardSliceErrorAlert failure={connectFailure} />
      ) : (
        <ConnectWorkspace
          publishableKey={clientConfig.publishableKey}
          connectEnforced={clientConfig.connectEnforced}
          status={connectRes.ok ? connectRes.data : null}
          syncDegraded={connectRes.ok ? Boolean(connectRes.data.syncDegraded) : false}
          legalEntityId={id}
          memberRole={member.role}
          entityStatus={entity?.status ?? member.status}
          kycApproved
          isLaxManaged={entity?.isLaxManaged ?? false}
          returnPath={`/dashboard/organisations/${id}/connect`}
          showDashboardLink={false}
        />
      )}
    </div>
  );
}
