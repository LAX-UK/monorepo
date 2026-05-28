import { ConnectWorkspace } from "@/components/connect/connect-workspace";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
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

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker={<LabelCaps>Payouts</LabelCaps>}
        heading={<DisplayHeading as="h2">Payout setup</DisplayHeading>}
      />
      <p className="font-body text-sm text-on-surface-variant">
        Manage bank details and Stripe requirements without leaving LAX.
      </p>
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
      />
    </div>
  );
}
