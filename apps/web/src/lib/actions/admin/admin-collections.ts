"use server";

import { COLLECTIONS_PATH } from "@/lib/admin/collections/collections.vm";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import { collectionChangeSchema } from "@/lib/data/http/admin-collections.reader";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { COLLECTIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts/staff-step-up";
import type { StaffAffectedBooking, StaffCollectionChangeResult } from "@auction/types";
import {
  addCollectionExceptionBodySchema,
  removeCollectionExceptionBodySchema,
  saveCollectionSettingsBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

const API = "/admin/collections";

const UNAVAILABLE = "We couldn't reach the collection settings. Nothing was changed. Try again.";

/** What the page needs from a refusal: the sentence, a code, and the bookings or fields behind it. */
type Refusal = {
  error?: string;
  message?: string;
  issues?: unknown;
  affected?: StaffAffectedBooking[];
};

async function send(
  name: string,
  method: "PUT" | "POST" | "DELETE",
  path: string,
  body: unknown,
  schema: z.ZodType,
): Promise<ActionResult<StaffCollectionChangeResult>> {
  return instrumentServerAction(name, async () => {
    const denied = await denyUnlessAdminCapability(COLLECTIONS_ACCESS);
    if (denied) return denied;
    const parsed = schema.safeParse(body);
    if (!parsed.success) return actionFailure("Check the details and try again.", undefined, 400);
    const res = await authedServerFetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    }).catch(() => null);
    if (!res) return actionFailure(UNAVAILABLE, undefined, 503);
    if (await isStaffStepUpResponse(res)) {
      return actionFailure("Recent sign-in required", undefined, 403, STAFF_STEP_UP_REQUIRED);
    }
    if (!res.ok) {
      const refusal = (await res.json().catch(() => ({}))) as Refusal;
      return actionFailure(refusal.message ?? UNAVAILABLE, undefined, res.status, refusal.error, {
        ...(refusal.affected ? { affected: refusal.affected } : {}),
        ...(refusal.issues ? { issues: refusal.issues } : {}),
      });
    }
    const result = readDataEnvelope(
      await readJsonBody(res),
      collectionChangeSchema,
      `${method} ${API}${path}`,
    );
    revalidatePath(COLLECTIONS_PATH);
    return actionSuccess(result);
  });
}

const venue = (venueId: string) => `/${encodeURIComponent(venueId)}`;

export async function saveCollectionSettingsAction(venueId: string, input: unknown) {
  return send(
    "saveCollectionSettingsAction",
    "PUT",
    venue(venueId),
    input,
    saveCollectionSettingsBodySchema,
  );
}

export async function addCollectionExceptionAction(venueId: string, input: unknown) {
  return send(
    "addCollectionExceptionAction",
    "POST",
    `${venue(venueId)}/exceptions`,
    input,
    addCollectionExceptionBodySchema,
  );
}

export async function removeCollectionExceptionAction(
  venueId: string,
  exceptionId: string,
  input: unknown,
) {
  return send(
    "removeCollectionExceptionAction",
    "DELETE",
    `${venue(venueId)}/exceptions/${encodeURIComponent(exceptionId)}`,
    input,
    removeCollectionExceptionBodySchema,
  );
}
