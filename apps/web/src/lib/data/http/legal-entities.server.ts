import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { LegalEntityMemberRole, LegalEntityStatus, LegalEntitySummary } from "@auction/types";

function parseLegalEntitySummary(raw: unknown): LegalEntitySummary {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    displayName: String(o.displayName ?? ""),
    kind: o.kind as LegalEntitySummary["kind"],
    subkind: o.subkind as LegalEntitySummary["subkind"],
    status: o.status as LegalEntityStatus,
    role: o.role as LegalEntityMemberRole,
    isPrimaryAdmin: Boolean(o.isPrimaryAdmin),
    ...(o.isImpersonation === true ? { isImpersonation: true as const } : {}),
  };
}

/** Active memberships for the signed-in user (`GET /legal-entities/me`). */
export async function getServerMyLegalEntityMemberships(): Promise<LegalEntitySummary[]> {
  const res = await authedServerFetch("/legal-entities/me", { cache: "no-store" });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: unknown[] };
  return (body.data ?? []).map(parseLegalEntitySummary);
}
