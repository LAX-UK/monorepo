import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";

export type PendingInvitationRow = {
  id: string;
  email: string;
  expiresAt: string;
  legalEntityId: string;
  orgDisplayName: string;
  orgSubkind: string;
  inviterUserId: string;
  inviterName: string;
  roleOffered: string;
};

export interface IPendingInvitationsGateway {
  listMine(): Promise<PendingInvitationRow[]>;
}

type AuthedFetch = typeof authedServerFetch;

export function createPendingInvitationsGateway(
  fetcher: AuthedFetch = authedServerFetch,
): IPendingInvitationsGateway {
  return {
    async listMine() {
      const res = await fetcher("/legal-entities/invitations/mine", { cache: "no-store" });
      if (!res.ok) return [];
      const body = (await res.json()) as { data: PendingInvitationRow[] };
      return body.data ?? [];
    },
  };
}
