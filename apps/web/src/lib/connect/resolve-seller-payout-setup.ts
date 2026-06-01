import type { PayoutSetupPill } from "@/components/dashboard/overview/compliance-status-strip";
import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "@/lib/connect/resolve-seller-connect-presentation";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";

/** Resolve seller payout setup pill for compliance strip (null when Connect not enforced). */
export async function resolveSellerPayoutSetupPill(input: {
  role: string;
  staffRole?: string | null;
}): Promise<PayoutSetupPill | null> {
  const sellerCtx = await resolveSellerWorkspaceContext(input.role, input.staffRole ?? null);
  if (!sellerCtx.sellerEntityId) return null;

  const hub = createOrganisationHubGateway();
  const [clientConfig, entity] = await Promise.all([
    getServerStripeConnectClientConfig(),
    hub.getEntityDetail(sellerCtx.sellerEntityId).catch(() => null),
  ]);
  const presentation = resolveSellerConnectPresentation({
    connectEnforced: clientConfig.connectEnforced,
    entity: entity ? legalEntityToConnectFields(entity) : null,
  });
  if (clientConfig.connectEnforced && !presentation.connectReady) {
    return { ready: false, href: DASHBOARD_ROUTES.sellerConnect };
  }
  if (clientConfig.connectEnforced && presentation.connectReady) {
    return { ready: true, href: DASHBOARD_ROUTES.sellerPayouts };
  }
  return null;
}
