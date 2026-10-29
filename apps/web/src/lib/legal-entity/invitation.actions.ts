"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import { invitationRefusalMessage } from "@/lib/legal-entity/invitation-refusal";
import type { ActionResult } from "@/lib/legal-entity/member-management.actions";
import { revalidatePath } from "next/cache";

export async function acceptInvitationByIdAction(
  invitationId: string,
): Promise<ActionResult<{ legalEntityId: string }>> {
  return instrumentServerAction("acceptInvitationByIdAction", async () => {
    const res = await authedServerFetch(`/legal-entities/invitations/${invitationId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      // A refusal in words: the server's own message when the organisation is closed to members.
      return { ok: false, error: invitationRefusalMessage(body as { code?: unknown } | null) };
    }
    const legalEntityId = (body as { data: { legalEntityId: string } }).data.legalEntityId;
    await switchActingLegalEntity(legalEntityId);
    revalidatePath("/organisations");
    revalidatePath("/invitations");
    revalidatePath("/organisations/invitations");
    revalidatePath("/", "layout");
    return {
      ok: true,
      data: { legalEntityId },
    };
  });
}

export async function declineInvitationByIdAction(
  invitationId: string,
  reason?: string,
): Promise<ActionResult> {
  return instrumentServerAction("declineInvitationByIdAction", async () => {
    const res = await authedServerFetch(`/legal-entities/invitations/${invitationId}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason ?? undefined }),
    });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, error: (body as { error?: string }).error ?? "decline_failed" };
    }
    revalidatePath("/organisations");
    revalidatePath("/organisations/invitations");
    revalidatePath("/invitations");
    return { ok: true };
  });
}
