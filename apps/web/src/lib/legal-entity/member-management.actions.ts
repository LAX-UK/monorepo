"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { teamHref } from "@/lib/navigation/client-routes";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { LegalEntityMemberRole } from "@auction/types";
import { revalidatePath } from "next/cache";
import { X_LEGAL_ENTITY_ID_HEADER } from "./client-acting-context";
import { type MemberChangeFailure, memberChangeFailure } from "./member-change-errors";

export type MemberRow = {
  id: string;
  legalEntityId: string;
  userId: string;
  role: LegalEntityMemberRole;
  isPrimaryAdmin: boolean;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string; image: string | null };
};

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/** A refused member change, in words, with the code a form maps to one of its fields. */
export type MemberChangeResult = { ok: true } | ({ ok: false } & MemberChangeFailure);

/** An invitation nobody has answered yet, as the team's managers see it. */
export type PendingInvitationRow = {
  id: string;
  email: string;
  role: LegalEntityMemberRole;
  sentAt: string;
  expiresAt: string;
};

function entityHeader(legalEntityId: string): Record<string, string> {
  return { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId };
}

function jsonHeaders(legalEntityId: string): Record<string, string> {
  return { "Content-Type": "application/json", ...entityHeader(legalEntityId) };
}

/** Every page that shows the team or the person's accounts. */
function revalidateTeamPages() {
  revalidatePath(teamHref());
  revalidatePath("/organisations");
  revalidatePath("/invitations");
  revalidatePath("/organisations/invitations");
}

/** Sends one member change and answers in words; the server decides whether it is allowed. */
async function sendChange(
  name: string,
  path: string,
  init: RequestInit,
): Promise<MemberChangeResult> {
  return instrumentServerAction(name, async () => {
    const res = await authedServerFetch(path, init);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: unknown; code?: unknown };
      return { ok: false, ...memberChangeFailure(body) };
    }
    revalidateTeamPages();
    return { ok: true };
  });
}

export async function listMembersAction(legalEntityId: string): Promise<ActionResult<MemberRow[]>> {
  return instrumentServerAction("listMembersAction", async () => {
    const res = await authedServerFetch("/legal-entities/members", {
      headers: entityHeader(legalEntityId),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `list_failed_${res.status}` };
    }
    const body = (await res.json()) as { data: MemberRow[] };
    return { ok: true, data: body.data };
  });
}

/** Sends an invitation email; sending again to the same address replaces the open invitation. */
export async function inviteMemberAction(
  legalEntityId: string,
  email: string,
  role: LegalEntityMemberRole,
): Promise<MemberChangeResult> {
  return sendChange("inviteMemberAction", "/legal-entities/members", {
    method: "POST",
    headers: jsonHeaders(legalEntityId),
    body: JSON.stringify({ email, role }),
  });
}

export async function updateMemberRoleAction(
  legalEntityId: string,
  memberId: string,
  role: LegalEntityMemberRole,
): Promise<MemberChangeResult> {
  return sendChange("updateMemberRoleAction", `/legal-entities/members/${memberId}`, {
    method: "PATCH",
    headers: jsonHeaders(legalEntityId),
    body: JSON.stringify({ role }),
  });
}

export async function removeMemberAction(
  legalEntityId: string,
  memberId: string,
): Promise<MemberChangeResult> {
  return sendChange("removeMemberAction", `/legal-entities/members/${memberId}`, {
    method: "DELETE",
    headers: entityHeader(legalEntityId),
  });
}

/** Hands the person's ownership to `memberId`; they stay on as an admin. */
export async function transferOwnershipAction(
  legalEntityId: string,
  memberId: string,
  confirmationPhrase: string,
): Promise<MemberChangeResult> {
  return sendChange("transferOwnershipAction", "/legal-entities/members/transfer-ownership", {
    method: "POST",
    headers: jsonHeaders(legalEntityId),
    body: JSON.stringify({ memberId, confirmationPhrase }),
  });
}

/** Closes an invitation's link; `restoreInvitationAction` takes it back. */
export async function withdrawInvitationAction(
  legalEntityId: string,
  invitationId: string,
): Promise<MemberChangeResult> {
  return sendChange("withdrawInvitationAction", `/legal-entities/invitations/${invitationId}`, {
    method: "DELETE",
    headers: entityHeader(legalEntityId),
  });
}

/** Undoes a withdrawal while the invitation could still be used. */
export async function restoreInvitationAction(
  legalEntityId: string,
  invitationId: string,
): Promise<MemberChangeResult> {
  return sendChange(
    "restoreInvitationAction",
    `/legal-entities/invitations/${invitationId}/restore`,
    { method: "POST", headers: entityHeader(legalEntityId) },
  );
}
