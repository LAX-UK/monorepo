import "server-only";

import { getPendingEntityInviteCookie } from "@/lib/legal-entity/pending-invite-cookie.server";
import { invitationLinkPath } from "@/lib/navigation/invitation-link";

/**
 * Where a freshly verified person with an organisation invitation goes: the invitation page,
 * which shows what they were invited to and accepts only when they press "Accept invitation".
 * Read-only, so it is safe while the verify-email page renders. `null` without an invitation.
 */
export async function pendingInvitationAfterVerify(
  explicitToken?: string | null,
): Promise<string | null> {
  const trimmed = explicitToken?.trim();
  const token = trimmed && trimmed.length >= 10 ? trimmed : await getPendingEntityInviteCookie();
  return token ? invitationLinkPath(token) : null;
}
