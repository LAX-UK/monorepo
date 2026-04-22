"use server";

import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { notificationPreferencePatchSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

export async function updateNotificationPreferencesFromValuesAction(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = notificationPreferencePatchSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { notificationPrefs } = getWriteContainer();
  const r = await notificationPrefs.patch(parsed.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/dashboard/settings/notifications");
  return actionSuccess();
}
