"use server";

import type {
  AdminRegisterResolveBody,
  AdminRegisterResolveResult,
  AdminSoldAttentionOverrideResult,
} from "@auction/shop-contracts";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/** Records the decision on a conflict between Zoho and LAX; shop-api checks the capability. */
export async function resolveRegisterConflict(input: {
  conflictId: string;
  resolution: AdminRegisterResolveBody["resolution"];
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<AdminRegisterResolveResult>({
    bffPath: `artwork-register/conflicts/${encodeURIComponent(input.conflictId)}/resolve`,
    method: "POST",
    jsonBody: { resolution: input.resolution },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

/** "It is not sold": the reason is required and is kept in the artwork's history. */
export async function markNotSold(input: {
  attentionId: string;
  reason: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<AdminSoldAttentionOverrideResult>({
    bffPath: `artwork-register/attention/${encodeURIComponent(input.attentionId)}/not-sold`,
    method: "POST",
    jsonBody: { reason: input.reason.trim() },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}
