"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import type { AdminLegalEntityDocument } from "@/lib/data/http/admin.server";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { LEGAL_ENTITY_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts/staff-step-up";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

function val(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

function redirectToDetail(id: string, query?: { error?: string; success?: string }): never {
  const sp = new URLSearchParams();
  if (query?.error) sp.set("error", query.error);
  if (query?.success) sp.set("success", query.success);
  const qs = sp.toString();
  redirect(qs ? `/admin/legal-entities/${id}?${qs}` : `/admin/legal-entities/${id}`);
}

function redirectToList(query?: { error?: string }): never {
  const sp = new URLSearchParams();
  if (query?.error) sp.set("error", query.error);
  const qs = sp.toString();
  redirect(qs ? `/admin/legal-entities?${qs}` : "/admin/legal-entities");
}

export async function openAdminLegalEntityAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "openAdminLegalEntityAction",
    async () => {
      const raw = val(formData, "legalEntityId");
      const parsed = z.string().uuid().safeParse(raw);
      if (!parsed.success) {
        redirectToList({ error: "Enter a valid legal entity UUID." });
      }
      redirect(`/admin/legal-entities/${parsed.data}`);
    },
    { formData },
  );
}

const pathSegment: Record<string, string> = {
  request_docs: "request-docs",
  start_review: "start-review",
  approve: "approve",
};

async function readFailureMessage(res: Response): Promise<string> {
  let msg = `Request failed (${res.status})`;
  try {
    const j = (await res.json()) as { message?: string; error?: string };
    msg = (j.message ?? j.error ?? msg).slice(0, 280);
  } catch {
    // ignore
  }
  return msg;
}

export async function legalEntityLifecycleSimpleAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "legalEntityLifecycleSimpleAction",
    async () => {
      const id = val(formData, "legalEntityId");
      const op = val(formData, "op");
      const seg = pathSegment[op];
      if (!id || !seg) {
        redirectToList({ error: "Invalid request." });
      }
      const res = await authedServerFetch(
        `/admin/legal-entities/${encodeURIComponent(id)}/${seg}`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        redirectToDetail(id, { error: await readFailureMessage(res) });
      }
      revalidatePath(`/admin/legal-entities/${id}`);
      redirectToDetail(id, { success: "Transition applied." });
    },
    { formData },
  );
}

const REASON_MIN = 3;

/** Transitions that need a reason and a recent sign-in, by the API path segment they post to. */
const REASONED_PATH = {
  restrict: "restrict",
  lift_restriction: "lift-restriction",
} as const;

/**
 * Posts a transition that needs a reason. A stale sign-in comes back as the step-up code, so the
 * dialog can ask the person to sign in again and retry.
 */
async function runReasonedTransition(
  op: keyof typeof REASONED_PATH,
  legalEntityId: string,
  reason: string,
): Promise<ActionResult<void>> {
  const denied = await denyUnlessAdminCapability(LEGAL_ENTITY_WRITE_ACCESS);
  if (denied) return denied;
  const id = z.string().uuid().safeParse(legalEntityId.trim());
  if (!id.success) return actionFailure("Missing organisation");
  const trimmed = reason.trim();
  if (trimmed.length < REASON_MIN) {
    const message = `Enter a reason of at least ${REASON_MIN} characters.`;
    return actionFailure(message, { reason: [message] }, 400);
  }
  const res = await authedServerFetch(
    `/admin/legal-entities/${encodeURIComponent(id.data)}/${REASONED_PATH[op]}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: trimmed }),
    },
  );
  if (res.ok) {
    revalidatePath(`/admin/legal-entities/${id.data}`);
    return actionSuccess();
  }
  if (await isStaffStepUpResponse(res)) {
    return actionFailure("Recent sign-in required", undefined, 403, STAFF_STEP_UP_REQUIRED);
  }
  return actionFailure(await readFailureMessage(res), undefined, res.status);
}

/** Restricts an approved organisation, with the reason kept in the audit log. */
export async function legalEntityRestrictResultAction(
  legalEntityId: string,
  reason: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("legalEntityRestrictResultAction", () =>
    runReasonedTransition("restrict", legalEntityId, reason),
  );
}

/**
 * Lifts a restriction. The API moves the organisation to `approved` when Stripe Connect is ready
 * and to `connect_pending` otherwise.
 */
export async function legalEntityLiftRestrictionResultAction(
  legalEntityId: string,
  reason: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("legalEntityLiftRestrictionResultAction", () =>
    runReasonedTransition("lift_restriction", legalEntityId, reason),
  );
}

export async function legalEntityRejectAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "legalEntityRejectAction",
    async () => {
      const id = val(formData, "legalEntityId");
      const reason = val(formData, "reason");
      const confirmationPhrase = val(formData, "confirmationPhrase");
      if (!id) redirectToList({ error: "Missing entity." });
      if (confirmationPhrase !== "REJECT") {
        redirectToDetail(id, { error: "Type REJECT exactly to confirm rejection." });
      }
      if (reason.length < 3) {
        redirectToDetail(id, { error: "Reason must be at least 3 characters." });
      }
      const res = await authedServerFetch(
        `/admin/legal-entities/${encodeURIComponent(id)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, confirmationPhrase }),
        },
      );
      if (!res.ok) {
        redirectToDetail(id, { error: await readFailureMessage(res) });
      }
      revalidatePath(`/admin/legal-entities/${id}`);
      redirectToDetail(id, { success: "Entity rejected." });
    },
    { formData },
  );
}

export async function legalEntityArchiveAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "legalEntityArchiveAction",
    async () => {
      const id = val(formData, "legalEntityId");
      const reason = val(formData, "reason");
      const confirmationPhrase = val(formData, "confirmationPhrase");
      if (!id) redirectToList({ error: "Missing entity." });
      const entity = await getAdminLegalEntityById(id);
      if (!entity) {
        redirectToDetail(id, { error: "Entity not found." });
      }
      const expected = `ARCHIVE ${entity.displayName}`;
      if (confirmationPhrase !== expected) {
        redirectToDetail(id, {
          error: `Type exactly: ${expected}`,
        });
      }
      if (reason.length < 3) {
        redirectToDetail(id, { error: "Reason must be at least 3 characters." });
      }
      const res = await authedServerFetch(
        `/admin/legal-entities/${encodeURIComponent(id)}/archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, confirmationPhrase }),
        },
      );
      if (!res.ok) {
        redirectToDetail(id, { error: await readFailureMessage(res) });
      }
      revalidatePath(`/admin/legal-entities/${id}`);
      redirectToDetail(id, { success: "Entity archived." });
    },
    { formData },
  );
}

export async function reviewLegalEntityDocumentAction(input: {
  legalEntityId: string;
  documentId: string;
  reviewStatus: "approved" | "rejected";
  reviewNotes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return instrumentServerAction("reviewLegalEntityDocumentAction", async () => {
    const res = await authedServerFetch(
      `/admin/legal-entities/${encodeURIComponent(input.legalEntityId)}/documents/${encodeURIComponent(input.documentId)}/review`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewStatus: input.reviewStatus,
          reviewNotes: input.reviewNotes,
        }),
      },
    );
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const j = (await res.json()) as { error?: string };
        msg = j.error ?? msg;
      } catch {
        // ignore
      }
      return { ok: false, error: msg };
    }
    revalidatePath(`/admin/legal-entities/${input.legalEntityId}`);
    return { ok: true };
  });
}

export async function getAdminLegalEntityDocumentsAction(
  legalEntityId: string,
): Promise<{ ok: true; documents: AdminLegalEntityDocument[] } | { ok: false; error: string }> {
  return instrumentServerAction("getAdminLegalEntityDocumentsAction", async () => {
    const res = await authedServerFetch(
      `/admin/legal-entities/${encodeURIComponent(legalEntityId)}/documents`,
    );
    if (!res.ok) {
      return { ok: false, error: `Request failed (${res.status})` };
    }
    const j = (await res.json()) as { data: AdminLegalEntityDocument[] };
    return { ok: true, documents: j.data };
  });
}
