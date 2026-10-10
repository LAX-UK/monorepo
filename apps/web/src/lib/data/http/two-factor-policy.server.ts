import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { z } from "zod";

export type TwoFactorRequiredBy = "staff" | "org";

const requirementSchema = z.object({
  required: z.boolean(),
  sources: z.array(z.object({ scope: z.enum(["staff", "org"]) })),
});

const policyViewSchema = z.object({
  policy: z.object({
    required: z.boolean(),
    setBySubjectId: z.string().nullable(),
    setAt: z.string().nullable(),
  }),
  coverage: z.object({ members: z.number(), enrolled: z.number() }),
});

const orgPolicyViewSchema = policyViewSchema.extend({
  canEdit: z.boolean(),
  members: z.array(z.object({ userId: z.string(), twoFactorEnabled: z.boolean().nullable() })),
});

export type TwoFactorPolicyView = z.infer<typeof policyViewSchema>;
export type OrgTwoFactorPolicyView = z.infer<typeof orgPolicyViewSchema>;

async function readData<T>(res: Response, schema: z.ZodType<T>): Promise<T | null> {
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = schema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}

/** Which policies currently require two-step verification for the signed-in user; empty when none or unknown. */
export async function getServerMyTwoFactorRequiredBy(): Promise<TwoFactorRequiredBy[]> {
  const res = await authedServerFetch("/users/me/two-factor-requirement", { cache: "no-store" });
  const requirement = await readData(res, requirementSchema);
  if (!requirement?.required) return [];
  return [...new Set(requirement.sources.map((source) => source.scope))];
}

export async function getServerStaffTwoFactorPolicy(): Promise<TwoFactorPolicyView | null> {
  const res = await authedServerFetch("/admin/security/staff-two-factor", { cache: "no-store" });
  return readData(res, policyViewSchema);
}

/** Owners and admins only; `null` for other roles or when Identity is unavailable. */
export async function getServerOrgTwoFactorPolicy(
  legalEntityId: string,
): Promise<OrgTwoFactorPolicyView | null> {
  const res = await authedServerFetch("/legal-entities/two-factor-policy", {
    headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
    cache: "no-store",
  });
  return readData(res, orgPolicyViewSchema);
}
