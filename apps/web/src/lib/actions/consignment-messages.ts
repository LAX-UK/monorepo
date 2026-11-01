"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";
import type { ActionResult } from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { type ConsignmentMessage, parseConsignmentMessage } from "@/lib/seller/consignment-thread";
import type { PostConsignmentMessageBody } from "@auction/validators";

/** The refusal in words: the API's message when it gives one, else a plain fallback. */
function refusal(payload: unknown, fallback: string): string {
  const body = payload as { message?: unknown; error?: unknown } | null;
  if (typeof body?.message === "string" && body.message) return body.message;
  if (typeof body?.error === "string" && body.error && !body.error.includes("_")) {
    return body.error;
  }
  return fallback;
}

/** Sends a message on a consignment's thread, as the signed-in member of the account. */
export async function sendConsignmentMessageAction(
  submissionId: string,
  body: PostConsignmentMessageBody,
): Promise<ActionResult<ConsignmentMessage>> {
  return instrumentServerAction("sendConsignmentMessageAction", async () => {
    const res = await authedServerFetch(
      `/submissions/${encodeURIComponent(submissionId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ).catch(() => null);
    if (!res) {
      return { ok: false, error: "Not sent. Check your connection and try again." };
    }
    const payload = await readJsonBody(res).catch(() => null);
    if (!res.ok) {
      const code = (payload as { code?: unknown } | null)?.code;
      return {
        ok: false,
        status: res.status,
        error: refusal(payload, "Not sent. Try again."),
        ...(typeof code === "string" ? { errorCode: code } : {}),
      };
    }
    const message = parseConsignmentMessage(payload);
    return message ? { ok: true, data: message } : { ok: true };
  });
}

/** Marks the specialist's messages read for the account, once the member has opened them. */
export async function markConsignmentMessagesReadAction(
  submissionId: string,
): Promise<ActionResult<{ marked: number }>> {
  return instrumentServerAction("markConsignmentMessagesReadAction", async () => {
    const res = await authedServerFetch(
      `/submissions/${encodeURIComponent(submissionId)}/messages/read`,
      { method: "POST" },
    ).catch(() => null);
    if (!res?.ok) return { ok: false, error: "Could not mark the messages read." };
    const payload = (await readJsonBody(res).catch(() => null)) as {
      data?: { marked?: unknown };
    } | null;
    const marked = typeof payload?.data?.marked === "number" ? payload.data.marked : 0;
    return { ok: true, data: { marked } };
  });
}
