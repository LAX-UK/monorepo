import "server-only";

import {
  type DashboardSliceFailure,
  buildDashboardSliceFailure,
  describeDashboardSliceFailure,
  parseApiErrorCode,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import type { LegalEntitySummary, MemberLegalEntity } from "@auction/types";
import { createOrganisationHubGateway } from "./organisation-hub.gateway.server";

/** Membership + entity detail for a single organisation the user can access. */
export type PerOrganisationContext = {
  member: LegalEntitySummary;
  entity: MemberLegalEntity | null;
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

type ViewedBody = {
  data?:
    | (MemberLegalEntity & {
        membership?: { role?: string; isPrimaryAdmin?: boolean; isImpersonation?: boolean };
      })
    | null;
};

/**
 * The context of an organisation a staff member is viewing as the client, from the API's answer
 * to `GET /legal-entities/:id`; `null` unless that answer is a live view session of an
 * organisation (the API validated the session for this very account).
 */
export function viewedOrganisationOf(body: unknown): PerOrganisationContext | null {
  const row = (body as ViewedBody | null)?.data;
  const membership = row?.membership;
  if (!row || row.kind !== "organisation" || !membership?.isImpersonation || !membership.role) {
    return null;
  }
  const { membership: _m, ...entity } = row;
  return {
    member: {
      id: row.id,
      displayName: row.displayName,
      kind: row.kind,
      subkind: row.subkind,
      status: row.status,
      role: membership.role as LegalEntitySummary["role"],
      isPrimaryAdmin: membership.isPrimaryAdmin ?? false,
      isImpersonation: true,
    },
    entity: entity as MemberLegalEntity,
  };
}

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
      // Support staff viewing as the client are not members: the API answers with the viewed
      // organisation and a read-only impersonation membership, which opens every reading tab.
      const viewed = viewedOrganisationOf(await res.json().catch(() => null));
      return viewed ? { kind: "ok", context: viewed } : { kind: "not_found" };
    },
  };
}
