import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { LegalEntity, LegalEntitySummary } from "@auction/types";
import { createOrganisationHubGateway } from "./organisation-hub.gateway.server";

/** Membership + entity detail for a single organisation the user can access. */
export type PerOrganisationContext = {
  member: LegalEntitySummary;
  entity: LegalEntity | null;
};

/** Per-organisation dashboard data (separate from hub list / inbox gateways — ISP). */
export interface IPerOrgGateway {
  getContext(legalEntityId: string): Promise<PerOrganisationContext | null>;
}

type AuthedFetch = typeof authedServerFetch;

export function createPerOrgGateway(fetcher: AuthedFetch = authedServerFetch): IPerOrgGateway {
  const hub = createOrganisationHubGateway(fetcher);
  return {
    async getContext(legalEntityId) {
      const memberships = await hub.listMemberships();
      const member = memberships.find((m) => m.id === legalEntityId && m.kind === "organisation");
      if (!member) return null;
      const entity = await hub.getEntityDetail(legalEntityId);
      return { member, entity };
    },
  };
}
