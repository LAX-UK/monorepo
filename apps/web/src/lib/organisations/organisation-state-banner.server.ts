import "server-only";

import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "@/lib/connect/resolve-seller-connect-presentation";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import {
  type OrganisationBannerView,
  organisationBannerView,
} from "@/lib/presenters/organisation-state/organisation-state-copy";
import { type EntityActor, entityCapabilitiesOf, organisationStatePolicy } from "@auction/domain";
import type { LegalEntity } from "@auction/types";

/**
 * The organisation's state banner for this member, outside Home (the Organisation page). The
 * policy decides whether there is one and who acts; payouts count as ready when their setup
 * cannot be read, so a slow read never invents a task.
 */
export async function loadOrganisationStateBanner(
  actor: EntityActor,
  entity: LegalEntity,
): Promise<OrganisationBannerView | null> {
  const config = await getServerStripeConnectClientConfig().catch(() => null);
  const payoutsReady = config
    ? resolveSellerConnectPresentation({
        connectEnforced: config.connectEnforced,
        entity: legalEntityToConnectFields(entity),
      }).connectReady
    : true;
  const { banner } = organisationStatePolicy(entity.status, entityCapabilitiesOf(actor), {
    payoutsReady,
  });
  return banner ? organisationBannerView(banner, { organisationName: entity.displayName }) : null;
}
