import "server-only";
import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "@/lib/connect/resolve-seller-connect-presentation";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import { listServerSoldLots } from "@/lib/data/http/workspace-selling.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import {
  type SoldAndPayoutsVm,
  buildPayoutDestination,
  buildPayoutRows,
} from "./sold-and-payouts.vm";

/**
 * Sold & payouts' read model for one selling account: its payouts and the next one's preview,
 * its sold lots with where their money stands, and whether payouts are set up. The payouts are
 * the page; the rest degrades quietly. Returns `null` when the payouts could not be read.
 */
export async function loadSoldAndPayouts(sellerEntityId: string): Promise<SoldAndPayoutsVm | null> {
  const c = await getServerDataContainer();
  const [list, preview, clientConfig, entity, lots] = await Promise.all([
    c.sellerPayouts.listForLegalEntity(sellerEntityId),
    c.sellerPayouts.previewNextForLegalEntity(sellerEntityId),
    getServerStripeConnectClientConfig(),
    createOrganisationHubGateway()
      .getEntityDetail(sellerEntityId)
      .catch(() => null),
    // Members who do not see the money are refused; the page then says it could not load them.
    listServerSoldLots()
      .then((page) => page.items)
      .catch(() => null),
  ]);
  if (!list.ok) return null;

  const connect = resolveSellerConnectPresentation({
    connectEnforced: clientConfig.connectEnforced,
    entity: entity ? legalEntityToConnectFields(entity) : null,
  });
  return {
    destination: buildPayoutDestination({
      ready: connect.connectReady,
      preview: preview.ok ? preview.data : null,
    }),
    sold: lots,
    payouts: buildPayoutRows(list.payouts, sellerEntityId),
  };
}
