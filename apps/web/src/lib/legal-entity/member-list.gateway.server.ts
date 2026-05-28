import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import {
  type ActingLegalEntitySummary,
  X_LEGAL_ENTITY_ID_HEADER,
} from "@/lib/legal-entity/client-acting-context";
import type { MemberRow } from "@/lib/legal-entity/member-management.actions";
import { parseApiErrorCodeFromBody, type ApiErrorBody } from "@auction/validators";

export type MemberListFetchResult =
  | { ok: true; data: MemberRow[] }
  | { ok: false; status: number; errorCode: string | null };

/** Abstraction over how the dashboard loads legal-entity members (DIP at the app boundary). */
export interface ILegalEntityMemberListGateway {
  fetchMemberListForActing(acting: ActingLegalEntitySummary): Promise<MemberListFetchResult>;
}

type AuthedFetch = typeof authedServerFetch;

async function parseErrorCodeFromResponse(res: Response): Promise<string | null> {
  try {
    const body = (await res.clone().json()) as ApiErrorBody & { message?: unknown };
    const candidate =
      parseApiErrorCodeFromBody(body) ?? (typeof body.message === "string" ? body.message : null);
    return candidate;
  } catch {
    return null;
  }
}

export function createLegalEntityMemberListGateway(
  fetcher: AuthedFetch = authedServerFetch,
): ILegalEntityMemberListGateway {
  return {
    async fetchMemberListForActing(acting) {
      if (!acting.id) {
        return { ok: false, status: 400, errorCode: "missing_legal_entity_context" };
      }
      const res = await fetcher("/legal-entities/members", {
        headers: { [X_LEGAL_ENTITY_ID_HEADER]: acting.id },
        cache: "no-store",
      });
      if (!res.ok) {
        const errorCode = await parseErrorCodeFromResponse(res);
        return { ok: false, status: res.status, errorCode };
      }
      const body = (await res.json()) as { data: MemberRow[] };
      return { ok: true, data: body.data };
    },
  };
}
