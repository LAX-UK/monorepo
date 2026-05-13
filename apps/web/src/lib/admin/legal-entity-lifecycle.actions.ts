"use server";

import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
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
  const raw = val(formData, "legalEntityId");
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) {
    redirectToList({ error: "Enter a valid legal entity UUID." });
  }
  redirect(`/admin/legal-entities/${parsed.data}`);
}

const pathSegment: Record<string, string> = {
  request_docs: "request-docs",
  start_review: "start-review",
  approve: "approve",
  restrict: "restrict",
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
  const id = val(formData, "legalEntityId");
  const op = val(formData, "op");
  const seg = pathSegment[op];
  if (!id || !seg) {
    redirectToList({ error: "Invalid request." });
  }
  const res = await authedServerFetch(`/admin/legal-entities/${encodeURIComponent(id)}/${seg}`, {
    method: "POST",
  });
  if (!res.ok) {
    redirectToDetail(id, { error: await readFailureMessage(res) });
  }
  revalidatePath(`/admin/legal-entities/${id}`);
  redirectToDetail(id, { success: "Transition applied." });
}

export async function legalEntityRejectAction(formData: FormData): Promise<void> {
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
  const res = await authedServerFetch(`/admin/legal-entities/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, confirmationPhrase }),
  });
  if (!res.ok) {
    redirectToDetail(id, { error: await readFailureMessage(res) });
  }
  revalidatePath(`/admin/legal-entities/${id}`);
  redirectToDetail(id, { success: "Entity rejected." });
}

export async function legalEntityArchiveAction(formData: FormData): Promise<void> {
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
  const res = await authedServerFetch(`/admin/legal-entities/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, confirmationPhrase }),
  });
  if (!res.ok) {
    redirectToDetail(id, { error: await readFailureMessage(res) });
  }
  revalidatePath(`/admin/legal-entities/${id}`);
  redirectToDetail(id, { success: "Entity archived." });
}
