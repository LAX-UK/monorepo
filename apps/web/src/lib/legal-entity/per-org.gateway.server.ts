import "server-only";

import {
  type DashboardSliceFailure,
  buildDashboardSliceFailure,
  describeDashboardSliceFailure,
  parseApiErrorCode,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import type { LegalEntity, LegalEntitySummary } from "@auction/types";
import { createOrganisationHubGateway } from "./organisation-hub.gateway.server";

/** Membership + entity detail for a single organisation the user can access. */
export type PerOrganisationContext = {
  member: LegalEntitySummary;
  entity: LegalEntity | null;
};

export type OrgAccessResult =
  | { kind: "ok"; context: PerOrganisationContext }
  | { kind: "forbidden"; failure: DashboardSliceFailure }
  | { kind: "not_found" };

/** Per-organisation dashboard data (separate from hub list / inbox gateways — ISP). */
export interface IPerOrgGateway {
  getContext(legalEntityId: string): Promise<PerOrganisationContext | null>;
  resolveAccess(legalEntityId: string): Promise<OrgAccessResult>;
}

type AuthedFetch = typeof authedServerFetch;

export function createPerOrgGateway(fetcher: AuthedFetch = authedServerFetch): IPerOrgGateway {
  const hub = createOrganisationHubGateway(fetcher);
  return {
    async getContext(legalEntityId) {
      const access = await this.resolveAccess(legalEntityId);
      return access.kind === "ok" ? access.context : null;
    },
    async resolveAccess(legalEntityId) {
      let memberships: Awaited<ReturnType<typeof hub.listMemberships>>;
      try {
        memberships = await hub.listMemberships();
      } catch (e) {
        return {
          kind: "forbidden",
          failure: describeDashboardSliceFailure(
            e,
            "legalEntities",
            "Could not load organisation memberships.",
          ),
        };
      }
      const member = memberships.find((m) => m.id === legalEntityId && m.kind === "organisation");
      if (member) {
        const entity = await hub.getEntityDetail(legalEntityId);
        return { kind: "ok", context: { member, entity } };
      }

      const res = await fetcher(`/legal-entities/${legalEntityId}`, {
        headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
        cache: "no-store",
      });
      if (res.status === 403) {
        const code = await parseApiErrorCode(res);
        return {
          kind: "forbidden",
          failure: buildDashboardSliceFailure("legalEntities", 403, code),
        };
      }
      if (res.status === 404) {
        return { kind: "not_found" };
      }
      if (!res.ok) {
        const code = await parseApiErrorCode(res);
        return {
          kind: "forbidden",
          failure: buildDashboardSliceFailure("legalEntities", res.status, code),
        };
      }
      return { kind: "not_found" };
    },
  };
}
