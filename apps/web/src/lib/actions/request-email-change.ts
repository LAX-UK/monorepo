"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { actionFailureFromService } from "@/lib/auth/action-from-service-failure";
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
  return instrumentServerAction("requestEmailChangeAction", async () => {
    const parsed = requestEmailChangeSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }

    const { account } = getWriteContainer();
    const result = await account.requestEmailChange(parsed.data);
    if (!result.ok) return actionFailureFromService(result);
    revalidatePath("/dashboard/settings/account");
    return actionSuccess();
  });
}

export type ConfirmEmailChangeData = { completed: true } | { completed: false; message?: string };

export async function confirmEmailChangeAction(
  token: string,
): Promise<ActionResult<ConfirmEmailChangeData>> {
  return instrumentServerAction("confirmEmailChangeAction", async () => {
    const { account } = getWriteContainer();
    const result = await account.confirmEmailChange({ token });
    if (!result.ok) return actionFailureFromService(result);
    revalidatePath("/dashboard/settings/account");
    const data = result.data as { completed?: boolean; message?: string };
    if (data.completed) {
      return actionSuccess({ completed: true });
    }
    const out: { completed: false; message?: string } = { completed: false };
    if (typeof data.message === "string" && data.message.length > 0) {
      out.message = data.message;
    }
    return actionSuccess(out);
  });
}

export async function cancelEmailChangeAction(): Promise<ActionResult<void>> {
  return instrumentServerAction("cancelEmailChangeAction", async () => {
    const { account } = getWriteContainer();
    const result = await account.cancelEmailChange();
    if (!result.ok) return actionFailureFromService(result);
    revalidatePath("/dashboard/settings/account");
    return actionSuccess();
  });
}
