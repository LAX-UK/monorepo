"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { readApiError } from "@/lib/actions/_utils";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { passwordChangeFormSchema } from "@auction/validators";

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/** Server action: POST to Better Auth `change-password` (API base + cookies).
 */
export async function changePasswordAction(
  input: ChangePasswordInput,
): Promise<ActionResult<void>> {
  return instrumentServerAction("changePasswordAction", async () => {
    const parsed = passwordChangeFormSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const res = await authedServerFetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: false,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return actionFailure(readApiError(body, "Could not change password"), undefined, res.status);
    }
    return actionSuccess();
  });
}
