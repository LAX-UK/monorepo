import "server-only";

import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "@/lib/connect/resolve-seller-connect-presentation";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import type { SellerConnectNavBadgeInput } from "@/lib/shell/apply-seller-connect-nav-badges";

/** Resolve nav badge input for selling workspace shell (server-only). */
export async function loadSellerConnectNavBadge(
  userRole?: string | null,
  userStaffRole?: string | null,
): Promise<SellerConnectNavBadgeInput | null> {
  const sellerCtx = await resolveSellerWorkspaceContext(userRole, userStaffRole);
  if (!sellerCtx.sellerEntityId) return null;

  const hub = createOrganisationHubGateway();
  const [clientConfig, entity] = await Promise.all([
    getServerStripeConnectClientConfig(),
    hub.getEntityDetail(sellerCtx.sellerEntityId).catch(() => null),
  ]);
  if (!clientConfig.connectEnforced || !entity) return null;

  const presentation = resolveSellerConnectPresentation({
    connectEnforced: clientConfig.connectEnforced,
    entity: legalEntityToConnectFields(entity),
  });

  return {
    connectEnforced: clientConfig.connectEnforced,
    connectReady: presentation.connectReady,
  };
}
