"use server";

import { actionFailureFromService } from "@/lib/auth/action-from-service-failure";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { revalidatePath } from "next/cache";

const CONFIRM = "DELETE MY ACCOUNT" as const;

export async function requestAccountDeletionAction(
  confirmation: string,
): Promise<ActionResult<void>> {
  if (confirmation !== CONFIRM) {
    return actionFailure("Type the confirmation phrase exactly.");
  }
  const { account } = getWriteContainer();
  const result = await account.requestAccountDeletion({ confirmation: CONFIRM });
  if (!result.ok) return actionFailureFromService(result);
  revalidatePath("/dashboard/settings/security");
  return actionSuccess();
}
