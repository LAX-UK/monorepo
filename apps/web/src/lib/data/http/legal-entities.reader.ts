import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import { legalEntitySummarySchema } from "@/lib/data/http/legal-entities.schema";
import type { LegalEntitySummary } from "@auction/types";

/** Active memberships for the signed-in user (`GET /legal-entities/me`). */
export async function getServerMyLegalEntityMemberships(): Promise<LegalEntitySummary[]> {
  const res = await authedServerFetch("/legal-entities/me", { cache: "no-store" });
  if (!res.ok) return [];
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, legalEntitySummarySchema, "GET /legal-entities/me");
  return rows;
}
