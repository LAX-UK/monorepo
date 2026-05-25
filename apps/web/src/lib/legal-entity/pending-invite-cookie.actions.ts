"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import {
  clearPendingEntityInviteCookie,
  setPendingEntityInviteCookie,
} from "./pending-invite-cookie.server";

export async function rememberPendingEntityInviteAction(token: string): Promise<void> {
  return instrumentServerAction("rememberPendingEntityInviteAction", async () => {
    if (token.length < 10 || token.length > 500) return;
    await setPendingEntityInviteCookie(token);
  });
}

export async function clearPendingEntityInviteAction(): Promise<void> {
  return instrumentServerAction("clearPendingEntityInviteAction", async () => {
    await clearPendingEntityInviteCookie();
  });
}
