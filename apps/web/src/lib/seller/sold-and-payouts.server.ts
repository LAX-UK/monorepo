import "server-only";
import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "@/lib/connect/resolve-seller-connect-presentation";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { SELLING_PAGE_LIMIT } from "./selling-overview.server";
import {
  type SoldAndPayoutsVm,
  buildPayoutDestination,
  buildPayoutRows,
  buildSoldWorks,
} from "./sold-and-payouts.vm";

/**
 * Sold & payouts' read model for one selling account: its payouts and the next one's preview,
 * its sold lots and whether payouts are set up. The payouts are the page; the rest degrades
 * quietly. Returns `null` when the payouts could not be read.
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
    // Only ended lots can have sold; without a status the list returns open lots alone.
    c.sellerLots
      .list({ sellerId: sellerEntityId, status: "ended", limit: SELLING_PAGE_LIMIT })
      .catch(() => []),
  ]);
  if (!list.ok) return null;

  const connect = resolveSellerConnectPresentation({
    connectEnforced: clientConfig.connectEnforced,
    entity: entity ? legalEntityToConnectFields(entity) : null,
  });
  const saleTitleById = await resolveSaleTitles(lots.map((lot) => lot.saleId));
  return {
    destination: buildPayoutDestination({
      ready: connect.connectReady,
      preview: preview.ok ? preview.data : null,
    }),
    sold: buildSoldWorks(lots, saleTitleById),
    payouts: buildPayoutRows(list.payouts, sellerEntityId),
  };
}
