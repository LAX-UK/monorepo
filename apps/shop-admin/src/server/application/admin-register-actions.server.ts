"use server";

import type { AdminRegisterResolveBody, AdminRegisterResolveResult } from "@auction/shop-contracts";
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
