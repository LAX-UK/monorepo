"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
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
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, error: (body as { error?: string }).error ?? "accept_failed" };
    }
    const legalEntityId = (body as { data: { legalEntityId: string } }).data.legalEntityId;
    await switchActingLegalEntity(legalEntityId);
    revalidatePath("/dashboard/organisations");
    revalidatePath("/invitations");
    revalidatePath("/dashboard/invitations");
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
    revalidatePath("/dashboard/organisations");
    revalidatePath("/dashboard/invitations");
    revalidatePath("/invitations");
    return { ok: true };
  });
}
