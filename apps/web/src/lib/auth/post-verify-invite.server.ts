"use server";

import { acceptInvitationAction } from "@/lib/legal-entity/member-management.actions";
import {
  clearPendingEntityInviteCookie,
  getPendingEntityInviteCookie,
} from "@/lib/legal-entity/pending-invite-cookie.server";

/** After email verification, auto-accept a pending org invite (URL `?invite=` or signup cookie). */
export async function tryConsumePendingInviteAfterVerify(
  explicitToken?: string | null,
): Promise<{ redirectTo: string } | null> {
  const trimmed = explicitToken?.trim();
  const token = trimmed && trimmed.length >= 10 ? trimmed : await getPendingEntityInviteCookie();
  if (!token) return null;
  const res = await acceptInvitationAction(token);
  if (!res.ok) {
    return null;
  }
  await clearPendingEntityInviteCookie();
  return { redirectTo: `/dashboard/organisations/${res.data.legalEntityId}?welcome=1` };
}
