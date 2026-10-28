import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import type { MyBuyerAgentAuthorisation } from "@auction/types";
import { z } from "zod";

import type { FormerMemberOpenBidRow } from "./organisation-membership.types";

export type { FormerMemberOpenBidRow };

const formerMemberBidSchema = z.object({
  kind: z.enum(["auto_bid", "absentee"]),
  id: z.string(),
  lotId: z.string(),
  lotTitle: z.string(),
  lotNumber: z.number().nullable(),
  endsAt: z.string(),
  memberUserId: z.string(),
  memberName: z.string(),
  maxAmount: z.string(),
}) satisfies z.ZodType<FormerMemberOpenBidRow>;

const myAuthorisationSchema = z.object({
  sale: z
    .object({
      id: z.string(),
      title: z.string(),
      startTime: z.string(),
      registered: z.boolean(),
    })
    .nullable(),
  bidLimit: z.string().nullable(),
  validUntil: z.string().nullable(),
}) satisfies z.ZodType<MyBuyerAgentAuthorisation>;

async function readList<T>(path: string, legalEntityId: string, schema: z.ZodType<T>) {
  const res = await authedServerFetch(path, {
    headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = z.array(schema).safeParse(body.data);
  return parsed.success ? parsed.data : null;
}

/** Former members' open bids; `null` for members who may not see them or on failure. */
export function getServerFormerMemberBids(
  legalEntityId: string,
): Promise<FormerMemberOpenBidRow[] | null> {
  return readList("/legal-entities/former-member-bids", legalEntityId, formerMemberBidSchema);
}

/** The signed-in buyer agent's own authorisations in force; empty for other roles. */
export async function getServerMyBuyerAgentAuthorisations(
  legalEntityId: string,
): Promise<MyBuyerAgentAuthorisation[]> {
  return (
    (await readList(
      "/legal-entities/buyer-agent-authorisations/mine",
      legalEntityId,
      myAuthorisationSchema,
    )) ?? []
  );
}
