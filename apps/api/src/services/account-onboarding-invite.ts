import { isOrgModuleEnabled } from "../lib/org-module-enabled.js";
import type { IInvitationConsumption } from "./invitation-consumption.service.js";

export type AcceptInviteForOnboardingInput = {
  inviteToken: string | undefined;
  email: string;
  userId: string;
  invitations: IInvitationConsumption;
  webOrigin: string;
};

export async function acceptInviteForOnboarding(
  input: AcceptInviteForOnboardingInput,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!input.inviteToken) return { ok: true };

  const validated = await input.invitations.validateForRegistration(input.inviteToken, input.email);
  if (validated.isErr()) {
    return {
      ok: false,
      message: validated.error.message,
      status: validated.error.status,
    };
  }

  const orgModuleEnabled = isOrgModuleEnabled(input.webOrigin);
  if (validated.value.targetLegalEntityId != null && !orgModuleEnabled) {
    return {
      ok: false,
      message: "Organisation invitations are not available yet",
      status: 403,
    };
  }

  if (validated.value.targetLegalEntityId == null) {
    const consumed = await input.invitations.consumeInviteForNewUser(
      input.inviteToken,
      input.userId,
      input.email,
    );
    if (consumed.isErr()) {
      return {
        ok: false,
        message: consumed.error.message,
        status: consumed.error.status,
      };
    }
  }

  return { ok: true };
}
