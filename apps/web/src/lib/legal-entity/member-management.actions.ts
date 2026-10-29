"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { normalizeApiErrorMessage } from "@auction/validators";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { LegalEntityMemberRole } from "@auction/types";
import { revalidatePath } from "next/cache";
import { X_LEGAL_ENTITY_ID_HEADER } from "./client-acting-context";

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

function entityHeader(legalEntityId: string): Record<string, string> {
  return { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId };
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

export async function inviteMemberAction(
  legalEntityId: string,
  email: string,
  role: LegalEntityMemberRole,
): Promise<ActionResult<{ memberId: string | null; invitationToken: string | null }>> {
  return instrumentServerAction("inviteMemberAction", async () => {
    const res = await authedServerFetch("/legal-entities/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...entityHeader(legalEntityId) },
      body: JSON.stringify({ email, role }),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: normalizeApiErrorMessage((body as { error?: unknown }).error, "invite_failed"),
      };
    }
    revalidatePath("/organisations");
    revalidatePath("/invitations");
    revalidatePath("/organisations/invitations");
    return {
      ok: true,
      data: (body as { data: { memberId: string | null; invitationToken: string | null } }).data,
    };
  });
}

export async function updateMemberRoleAction(
  legalEntityId: string,
  memberId: string,
  role: LegalEntityMemberRole,
): Promise<ActionResult> {
  return instrumentServerAction("updateMemberRoleAction", async () => {
    const res = await authedServerFetch(`/legal-entities/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...entityHeader(legalEntityId) },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: unknown };
      return { ok: false, error: normalizeApiErrorMessage(body.error, "update_failed") };
    }
    revalidatePath("/organisations");
    revalidatePath("/invitations");
    revalidatePath("/organisations/invitations");
    return { ok: true };
  });
}

export async function removeMemberAction(
  legalEntityId: string,
  memberId: string,
  opts?: { confirmationPhrase?: string },
): Promise<ActionResult> {
  return instrumentServerAction("removeMemberAction", async () => {
    const deleteInit: RequestInit = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...entityHeader(legalEntityId),
      },
    };
    if (opts?.confirmationPhrase !== undefined) {
      deleteInit.body = JSON.stringify({ confirmationPhrase: opts.confirmationPhrase });
    }
    const res = await authedServerFetch(`/legal-entities/members/${memberId}`, deleteInit);
    if (!res.ok) {
      const body = (await res.json()) as { error?: unknown };
      return { ok: false, error: normalizeApiErrorMessage(body.error, "remove_failed") };
    }
    revalidatePath("/organisations");
    revalidatePath("/invitations");
    revalidatePath("/organisations/invitations");
    return { ok: true };
  });
}

export async function transferPrimaryAdminAction(
  legalEntityId: string,
  memberId: string,
  confirmationPhrase: string,
): Promise<ActionResult> {
  return instrumentServerAction("transferPrimaryAdminAction", async () => {
    const res = await authedServerFetch("/legal-entities/members/transfer-primary-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...entityHeader(legalEntityId) },
      body: JSON.stringify({ memberId, confirmationPhrase }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      return { ok: false, error: normalizeApiErrorMessage(body.error, "transfer_failed") };
    }
    revalidatePath("/organisations");
    revalidatePath("/invitations");
    revalidatePath("/organisations/invitations");
    return { ok: true };
  });
}
