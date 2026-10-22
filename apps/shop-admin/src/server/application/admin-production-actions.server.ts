"use server";

import { PRODUCTION_TASK_STATUSES, type ProductionTaskStatus } from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateProductionTask(input: {
  id: string;
  /** The version the page was rendered with; the API refuses the change if it has moved on. */
  expectedVersion: number;
  status?: ProductionTaskStatus;
  /** A staff identity subject, or null to unassign. */
  assigneeSubject?: string | null;
}): Promise<AdminMutationResult<{ version: number; status: ProductionTaskStatus }>> {
  if (
    !UUID_PATTERN.test(input.id) ||
    !Number.isInteger(input.expectedVersion) ||
    (input.status !== undefined && !PRODUCTION_TASK_STATUSES.includes(input.status))
  ) {
    return { ok: false, kind: "validation", message: "Invalid production task request." };
  }
  return forwardAdminJsonMutation({
    bffPath: `production/tasks/${input.id}`,
    method: "PATCH",
    jsonBody: {
      expectedVersion: input.expectedVersion,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assigneeSubject !== undefined ? { assigneeSubject: input.assigneeSubject } : {}),
    },
  });
}
