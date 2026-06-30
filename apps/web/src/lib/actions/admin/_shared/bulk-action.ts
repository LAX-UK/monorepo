import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";

export async function postBulkAction(
  path: string,
  body: unknown,
  fallback: string,
): Promise<ActionResult<void>> {
  const res = await authedServerFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    return actionFailure(payload.error ?? fallback, undefined, res.status);
  }
  return actionSuccess();
}
