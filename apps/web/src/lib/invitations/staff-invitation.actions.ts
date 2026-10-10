"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { describeStaffInvitationError } from "./staff-invitation-errors";

export type AcceptStaffInvitationResult =
  | { ok: true; welcomePath: string }
  | { ok: false; error: string };

export async function acceptStaffInvitationAction(
  token: string,
): Promise<AcceptStaffInvitationResult> {
  return instrumentServerAction("acceptStaffInvitationAction", async () => {
    const res = await authedServerFetch("/users/me/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: { welcomePath?: unknown };
      error?: unknown;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: describeStaffInvitationError(typeof body.error === "string" ? body.error : null),
      };
    }
    const welcomePath =
      typeof body.data?.welcomePath === "string" ? body.data.welcomePath : "/invitations/welcome";
    return { ok: true, welcomePath };
  });
}
