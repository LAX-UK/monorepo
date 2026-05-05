"use server";

import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { requestEmailChangeSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

export async function requestEmailChangeAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = requestEmailChangeSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }

  const { account } = getWriteContainer();
  const result = await account.requestEmailChange(parsed.data);
  if (!result.ok) return actionFailure(result.message, undefined, result.status);
  revalidatePath("/dashboard/settings/account");
  return actionSuccess();
}

export async function confirmEmailChangeAction(token: string): Promise<ActionResult<void>> {
  const { account } = getWriteContainer();
  const result = await account.confirmEmailChange({ token });
  if (!result.ok) return actionFailure(result.message, undefined, result.status);
  revalidatePath("/dashboard/settings/account");
  return actionSuccess();
}
