import "server-only";

import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "@/lib/connect/resolve-seller-connect-presentation";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import {
  type SellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import {
  type SellerAccountFacts,
  organisationIdentityFact,
  personalIdentityFact,
} from "@/lib/seller/consignment-checklist-facts";

export type LoadedSellerAccountFacts = SellerAccountFacts & {
  /** The organisation's name when selling as one. */
  organisationName: string | null;
};

/**
 * What the checklist needs to know about the account being sold as: whose identity is checked,
 * whether payouts are ready, and what the person looking may do. One read per page, shared by
 * every consignment on it.
 */
export async function loadSellerAccountFacts(
  ctx: SellerWorkspaceContext,
): Promise<LoadedSellerAccountFacts | null> {
  if (!ctx.sellerEntityId) return null;
  const c = await getServerDataContainer();
  const hub = createOrganisationHubGateway();
  const [clientConfig, entity, kyc] = await Promise.all([
    getServerStripeConnectClientConfig(),
    hub.getEntityDetail(ctx.sellerEntityId).catch(() => null),
    ctx.sellingAsOrganisation ? Promise.resolve(null) : c.kyc.getSummary().catch(() => null),
  ]);
  const payouts = resolveSellerConnectPresentation({
    connectEnforced: clientConfig.connectEnforced,
    entity: entity ? legalEntityToConnectFields(entity) : null,
  });
  return {
    accountKind: ctx.sellingAsOrganisation ? "organisation" : "personal",
    identity: ctx.sellingAsOrganisation
      ? organisationIdentityFact(entity?.status ?? null)
      : personalIdentityFact(kyc),
    payoutsReady: payouts.connectReady,
    viewer: {
      canAcceptAgreement: sellerCan(ctx, "entity.consignments.accept_agreement"),
      canSetUpPayouts: sellerCan(ctx, "entity.connect.operate"),
    },
    organisationName: ctx.sellingAsOrganisation ? (entity?.displayName ?? null) : null,
  };
}
