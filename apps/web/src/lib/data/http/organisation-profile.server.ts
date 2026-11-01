import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { z } from "zod";
import type {
  ContactDetailsView,
  MemberLastActiveView,
  PayoutAccountView,
  StatementView,
} from "./organisation-profile.types";

const contactDetailsSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  updatedAt: z.string().nullable(),
  canEdit: z.boolean(),
}) satisfies z.ZodType<ContactDetailsView>;

const statementSchema = z.object({
  kind: z.literal("payout"),
  payoutId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  netAmount: z.string(),
  currency: z.string(),
  payoutStatus: z.string(),
  issuedAt: z.string(),
  availability: z.enum(["ready", "on_request", "unavailable"]),
}) satisfies z.ZodType<StatementView>;

const payoutAccountSchema = z.union([
  z.object({ state: z.enum(["not_set_up", "none", "unavailable"]), account: z.null() }),
  z.object({
    state: z.literal("ready"),
    account: z.object({
      bankName: z.string().nullable(),
      last4: z.string().nullable(),
      accountHolderName: z.string().nullable(),
      currency: z.string().nullable(),
      status: z.enum(["ready", "failed"]),
    }),
  }),
]) satisfies z.ZodType<PayoutAccountView>;

const memberLastActiveSchema = z.object({
  available: z.boolean(),
  members: z.array(z.object({ userId: z.string(), lastActiveOn: z.string().nullable() })),
}) satisfies z.ZodType<MemberLastActiveView>;

async function read<T>(path: string, legalEntityId: string, schema: z.ZodType<T>) {
  const res = await authedServerFetch(path, {
    headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = schema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}

/** The organisation's contact details; `null` when they cannot be read. */
export function getServerContactDetails(legalEntityId: string) {
  return read("/legal-entities/contact-details", legalEntityId, contactDetailsSchema);
}

/** The organisation's statements, newest first; `null` when they cannot be read. */
export function getServerStatements(legalEntityId: string) {
  return read("/legal-entities/statements", legalEntityId, z.array(statementSchema));
}

/** The bank account payouts go to, as a summary; `null` when it cannot be read. */
export function getServerPayoutAccount(legalEntityId: string) {
  return read("/legal-entities/payout-account", legalEntityId, payoutAccountSchema);
}

/** The day each member was last active; `null` when it cannot be read. */
export function getServerMemberLastActive(legalEntityId: string) {
  return read("/legal-entities/members/last-active", legalEntityId, memberLastActiveSchema);
}
