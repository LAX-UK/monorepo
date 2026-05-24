"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { setPendingEntityInviteCookie } from "./pending-invite-cookie.server";

export async function rememberPendingEntityInviteAction(token: string): Promise<void> {
  return instrumentServerAction("rememberPendingEntityInviteAction", async () => {
    if (token.length < 10 || token.length > 500) return;
    await setPendingEntityInviteCookie(token);
  });
}
