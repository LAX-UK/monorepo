"use server";

import { COLLECTIONS_PATH } from "@/lib/admin/collections/collections.vm";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import { stepUpRequiredFailure } from "@/lib/auth/step-up/step-up-failure";
import { storageSettingsSchema } from "@/lib/data/http/admin-collection-storage.reader";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { COLLECTION_STORAGE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { StaffStorageSettings } from "@auction/types";
import {
  cancelStorageTermsBodySchema,
  setStorageChargingBodySchema,
  storageTermsBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

const UNAVAILABLE = "We couldn't reach the storage terms. Nothing was changed. Try again.";

type Refusal = { error?: string; message?: string; issues?: unknown };

export type StorageActionResult = ActionResult<StaffStorageSettings>;

async function send(
  name: string,
  method: "PUT" | "POST",
  path: string,
  body: unknown,
  schema: z.ZodType,
): Promise<StorageActionResult> {
  return instrumentServerAction(name, async () => {
    const denied = await denyUnlessAdminCapability(COLLECTION_STORAGE_ACCESS);
    if (denied) return denied;
    const parsed = schema.safeParse(body);
    if (!parsed.success) return actionFailure("Check the details and try again.", undefined, 400);
    const url = `/admin/collections${path}`;
    const res = await authedServerFetch(url, {
      method,
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
    const result = readDataEnvelope(
      await readJsonBody(res),
      storageSettingsSchema,
      `${method} ${url}`,
    );
    revalidatePath(COLLECTIONS_PATH);
    return actionSuccess(result);
  });
}

const storage = (venueId: string) => `/${encodeURIComponent(venueId)}/storage`;

export async function scheduleStorageTermsAction(venueId: string, input: unknown) {
  return send(
    "scheduleStorageTermsAction",
    "POST",
    `${storage(venueId)}/terms`,
    input,
    storageTermsBodySchema,
  );
}

export async function editStorageTermsAction(venueId: string, termsId: string, input: unknown) {
  return send(
    "editStorageTermsAction",
    "PUT",
    `${storage(venueId)}/terms/${encodeURIComponent(termsId)}`,
    input,
    storageTermsBodySchema,
  );
}

export async function cancelStorageTermsAction(venueId: string, termsId: string, input: unknown) {
  return send(
    "cancelStorageTermsAction",
    "POST",
    `${storage(venueId)}/terms/${encodeURIComponent(termsId)}/cancel`,
    input,
    cancelStorageTermsBodySchema,
  );
}

export async function setStorageChargingAction(venueId: string, input: unknown) {
  return send(
    "setStorageChargingAction",
    "PUT",
    `${storage(venueId)}/charging`,
    input,
    setStorageChargingBodySchema,
  );
}
