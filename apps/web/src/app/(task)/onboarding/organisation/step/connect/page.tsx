import { OrgConnectStepClient } from "@/app/(task)/onboarding/organisation/step/connect/org-connect-step-client";
import {
  getServerStripeConnectClientConfig,
  getServerStripeConnectStatus,
  syncServerStripeConnectStatus,
} from "@/lib/data/http/stripe-connect.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { redirect } from "next/navigation";

export default async function OrgOnboardingConnectStepPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; fresh?: string }>;
}) {
  const sp = await searchParams;
  const fresh = sp.fresh === "1";
  const entityId = fresh ? undefined : sp.entityId;
  if (!entityId) redirect("/onboarding/organisation/step/type");

  const hub = createOrganisationHubGateway();
  const entity = await hub.getEntityDetail(entityId).catch(() => null);
  const [clientConfig, connectRes] = await Promise.all([
    getServerStripeConnectClientConfig(),
    entity?.stripeConnectAccountId
      ? syncServerStripeConnectStatus(entityId)
      : getServerStripeConnectStatus(entityId),
  ]);

  const memberships = await hub.listMemberships().catch(() => []);
  const member = memberships.find((m) => m.id === entityId);

  return (
    <OrgConnectStepClient
      entityId={entityId}
      fresh={fresh}
      publishableKey={clientConfig.publishableKey}
      connectEnforced={clientConfig.connectEnforced}
      status={connectRes.ok ? connectRes.data : null}
      syncDegraded={connectRes.ok ? Boolean(connectRes.data.syncDegraded) : false}
      memberRole={member?.role ?? "owner"}
      entityStatus={entity?.status ?? "connect_pending"}
      isLaxManaged={entity?.isLaxManaged ?? false}
    />
  );
}
