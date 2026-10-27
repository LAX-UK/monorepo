import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { legalEntityMemberRoles } from "@auction/types";
import type { BidAuthorityView, BuyerAgentAuthorisationOverview } from "@auction/types";
import { z } from "zod";

const authorisationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  saleId: z.string().nullable(),
  saleTitle: z.string().nullable(),
  bidLimit: z.string().nullable(),
  validFrom: z.string(),
  validUntil: z.string().nullable(),
  status: z.enum(["active", "revoked"]),
  scheduled: z.boolean(),
  expired: z.boolean(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
  revokedReason: z.string().nullable(),
});

const overviewSchema = z.object({
  canManage: z.boolean(),
  buyerAgents: z.array(z.object({ userId: z.string(), name: z.string(), email: z.string() })),
  authorisations: z.array(authorisationSchema),
  sales: z.array(z.object({ id: z.string(), title: z.string(), startTime: z.string() })),
}) satisfies z.ZodType<BuyerAgentAuthorisationOverview>;

const roleSchema = z.enum(legalEntityMemberRoles);

const bidAuthoritySchema = z.discriminatedUnion("allowed", [
  z.object({
    allowed: z.literal(true),
    role: roleSchema,
    viaAuthorisation: z.boolean(),
    bidLimit: z.string().nullable(),
  }),
  z.object({
    allowed: z.literal(false),
    role: roleSchema.nullable(),
    reason: z.enum(["not_member", "role_cannot_bid", "authorisation_required"]),
  }),
]) satisfies z.ZodType<BidAuthorityView>;

async function readData<T>(res: Response, schema: z.ZodType<T>): Promise<T | null> {
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = schema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}

/** The acting organisation's buyer agents; `null` for members who may not see them. */
export async function getServerBuyerAgentOverview(
  legalEntityId: string,
): Promise<BuyerAgentAuthorisationOverview | null> {
  const res = await authedServerFetch("/legal-entities/buyer-agent-authorisations", {
    headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
    cache: "no-store",
  });
  return readData(res, overviewSchema);
}

/** Staff view of an organisation's buyer agents, for its legal entity record. */
export async function getServerAdminBuyerAgentOverview(
  legalEntityId: string,
): Promise<BuyerAgentAuthorisationOverview | null> {
  const res = await authedServerFetch(
    `/admin/legal-entities/${encodeURIComponent(legalEntityId)}/buyer-agent-authorisations`,
    { cache: "no-store" },
  );
  return readData(res, overviewSchema);
}

/**
 * Whether the signed-in person may bid for `legalEntityId` in `saleId`; `null` when the answer
 * is unavailable (the server still enforces the rule on every bid).
 */
export async function getServerBidAuthority(
  legalEntityId: string,
  saleId: string | null,
): Promise<BidAuthorityView | null> {
  const qs = saleId ? `?saleId=${encodeURIComponent(saleId)}` : "";
  const res = await authedServerFetch(`/legal-entities/bid-authority${qs}`, {
    headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
    cache: "no-store",
  });
  return readData(res, bidAuthoritySchema);
}
