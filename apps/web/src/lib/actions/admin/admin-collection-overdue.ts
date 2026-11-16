"use server";

import { COLLECTIONS_PATH } from "@/lib/admin/collections/collections.vm";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import { stepUpRequiredFailure } from "@/lib/auth/step-up/step-up-failure";
import { overdueLotsSchema } from "@/lib/data/http/admin-collection-overdue.reader";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { COLLECTIONS_ACCESS, COLLECTION_STORAGE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { CapabilityRequirement, StaffOverdueLots } from "@auction/types";
import { extendLotStorageBodySchema, waiveLotStorageBodySchema } from "@auction/validators";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

const UNAVAILABLE = "We couldn't reach the lot's storage. Nothing was changed. Try again.";

type Refusal = { error?: string; message?: string; issues?: unknown };

export type OverdueActionResult = ActionResult<StaffOverdueLots>;

async function send(
  name: string,
  access: CapabilityRequirement,
  path: string,
  body: unknown,
  schema: z.ZodType,
): Promise<OverdueActionResult> {
  return instrumentServerAction(name, async () => {
    const denied = await denyUnlessAdminCapability(access);
    if (denied) return denied;
    const parsed = schema.safeParse(body);
    if (!parsed.success) return actionFailure("Check the details and try again.", undefined, 400);
    const url = `/admin/collections${path}`;
    const res = await authedServerFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    if (!res) return actionFailure(UNAVAILABLE, undefined, 503);
    if (await isStaffStepUpResponse(res)) return stepUpRequiredFailure();
    if (!res.ok) {
      const refusal = (await res.json().catch(() => ({}))) as Refusal;
      return actionFailure(
        refusal.message ?? UNAVAILABLE,
        undefined,
        res.status,
        refusal.error,
        refusal.issues ? { issues: refusal.issues } : undefined,
      );
    }
    const result = readDataEnvelope(await readJsonBody(res), overdueLotsSchema, `POST ${url}`);
    revalidatePath(COLLECTIONS_PATH);
    return actionSuccess(result);
  });
}

const lotPath = (venueId: string, lotId: string) =>
  `/${encodeURIComponent(venueId)}/storage/lots/${encodeURIComponent(lotId)}`;

/** Fulfilment adds free storage days to one lot (up to 30 in all), with a reason. */
export async function extendLotStorageAction(venueId: string, lotId: string, input: unknown) {
  return send(
    "extendLotStorageAction",
    COLLECTIONS_ACCESS,
    `${lotPath(venueId, lotId)}/extension`,
    input,
    extendLotStorageBodySchema,
  );
}

/** Finance waives one lot's storage charges, with a reason; the API asks for a recent sign-in. */
export async function waiveLotStorageAction(venueId: string, lotId: string, input: unknown) {
  return send(
    "waiveLotStorageAction",
    COLLECTION_STORAGE_ACCESS,
    `${lotPath(venueId, lotId)}/waiver`,
    input,
    waiveLotStorageBodySchema,
  );
}
