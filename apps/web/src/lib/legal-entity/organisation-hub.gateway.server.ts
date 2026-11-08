import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import type { LegalEntitySummary, MemberLegalEntity } from "@auction/types";

export type OrganisationHubMembership = LegalEntitySummary;

export interface IOrganisationHubGateway {
  listMemberships(): Promise<OrganisationHubMembership[]>;
  /** The organisation as a member may read it (for hub card Stripe / KYB hints). */
  getEntityDetail(legalEntityId: string): Promise<MemberLegalEntity | null>;
}

type AuthedFetch = typeof authedServerFetch;

export function createOrganisationHubGateway(
  fetcher: AuthedFetch = authedServerFetch,
): IOrganisationHubGateway {
  return {
    async listMemberships() {
      const res = await fetcher("/legal-entities/me", { cache: "no-store" });
      if (res.status === 503) {
        await throwIfNotOk(res, "legalEntities");
      }
      if (!res.ok) return [];
      const body = (await res.json()) as { data: OrganisationHubMembership[] };
      return body.data ?? [];
    },
    async getEntityDetail(legalEntityId: string) {
      const res = await fetcher(`/legal-entities/${legalEntityId}`, {
        headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        data: MemberLegalEntity & { membership?: Record<string, unknown> };
      };
      const row = json.data;
      if (!row) return null;
      const { membership: _m, ...entity } = row;
      return entity;
    },
  };
}
