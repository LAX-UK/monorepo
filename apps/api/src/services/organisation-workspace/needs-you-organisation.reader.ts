import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import { isSellerConnectReady, shouldSkipConnect } from "../../lib/seller-connect-readiness.js";
import type { INeedsYouOrganisationReader } from "../interfaces/needs-you-service.js";

/**
 * The organisation's status, and whether it can be paid out: always when payouts are not
 * enforced (Stripe Connect not configured) or the account is exempt, else when Connect is ready.
 * The same rule the catalogue uses to hold a seller's lots back.
 */
export class NeedsYouOrganisationReader implements INeedsYouOrganisationReader {
  constructor(
    private readonly deps: {
      legalEntities: Pick<ILegalEntityRepository, "findById">;
      connectEnforced: () => boolean;
    },
  ) {}

  async standing(legalEntityId: string) {
    const entity = await this.deps.legalEntities.findById(legalEntityId);
    if (!entity) return null;
    const payoutsReady =
      !this.deps.connectEnforced() || shouldSkipConnect(entity) || isSellerConnectReady(entity);
    return { kind: entity.kind, status: entity.status, payoutsReady };
  }
}
