"use server";

import { readApiError } from "@/lib/actions/_utils";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { revalidatePath } from "next/cache";

export async function removeEmailSuppressionAction(emailHash: string): Promise<ActionResult<void>> {
  const res = await authedServerFetch(
    `/admin/email/suppressions/${encodeURIComponent(emailHash)}`,
    { method: "DELETE" },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    return actionFailure(readApiError(body, "Could not remove suppression"), undefined, res.status);
  revalidatePath("/admin/email/suppressions");
  return actionSuccess();
}
