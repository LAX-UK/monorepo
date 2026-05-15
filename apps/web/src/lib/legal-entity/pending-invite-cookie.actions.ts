"use server";

import { setPendingEntityInviteCookie } from "./pending-invite-cookie.server";

export async function rememberPendingEntityInviteAction(token: string): Promise<void> {
  if (token.length < 10 || token.length > 500) return;
  await setPendingEntityInviteCookie(token);
}
