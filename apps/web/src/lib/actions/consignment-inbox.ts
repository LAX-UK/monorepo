"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";
import type { ActionResult } from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type {
  ConsignmentAssignableStaff,
  ConsignmentInboxBulkBody,
  ConsignmentInboxBulkResult,
  ConsignmentThreadAssignBody,
  ConsignmentThreadMessageView,
  ConsignmentThreadReplyBody,
  SavedReplyBody,
  SavedReplyView,
} from "@auction/validators";

/**
 * Bid admin's writes to consignment threads: replies and notes (with the undo window and the
 * changed-while-you-wrote check), assignment, close and reopen, read state, bulk actions and the
 * team's saved replies. Each answers the API's own words when it refuses.
 */

const THREADS = "/admin/consignment-threads";
const SAVED_REPLIES = "/admin/consignment-saved-replies";
const OFFLINE = "Check your connection, then try again.";
const FAILED = "Something went wrong on our side. Try again in a moment.";

function refusal(payload: unknown, fallback: string): string {
  const body = payload as { message?: unknown; error?: unknown } | null;
  if (typeof body?.message === "string" && body.message) return body.message;
  if (typeof body?.error === "string" && body.error && !body.error.includes("_")) {
    return body.error;
  }
  return fallback;
}

async function call<T>(
  name: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<ActionResult<T>> {
  return instrumentServerAction(name, async () => {
    const res = await authedServerFetch(path, {
      method: init.method,
      ...(init.body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) }
        : {}),
    }).catch(() => null);
    if (!res) return { ok: false, error: OFFLINE };
    const payload = await readJsonBody(res).catch(() => null);
    if (!res.ok) {
      const code = (payload as { code?: unknown } | null)?.code;
      return {
        ok: false,
        status: res.status,
        error: refusal(payload, FAILED),
        ...(typeof code === "string" ? { errorCode: code } : {}),
        ...(payload && typeof payload === "object"
          ? { meta: payload as Record<string, unknown> }
          : {}),
      };
    }
    const data = (payload as { data?: T } | null)?.data;
    return data === undefined ? { ok: true } : { ok: true, data };
  });
}

const thread = (submissionId: string, rest = "") =>
  `${THREADS}/${encodeURIComponent(submissionId)}${rest}`;

/**
 * A reply or an internal note. A 409 with `errorCode: "thread_changed"` carries the client's new
 * messages in `meta.newMessages`.
 */
export async function postConsignmentThreadMessageAction(
  submissionId: string,
  body: ConsignmentThreadReplyBody,
): Promise<ActionResult<ConsignmentThreadMessageView>> {
  return call("postConsignmentThreadMessageAction", thread(submissionId, "/messages"), {
    method: "POST",
    body,
  });
}

/** Takes back a reply inside its undo window, before the client hears of it. */
export async function undoConsignmentThreadReplyAction(
  submissionId: string,
  messageId: string,
): Promise<ActionResult> {
  return call(
    "undoConsignmentThreadReplyAction",
    thread(submissionId, `/messages/${encodeURIComponent(messageId)}`),
    { method: "DELETE" },
  );
}

export async function assignConsignmentThreadAction(
  submissionId: string,
  body: ConsignmentThreadAssignBody,
): Promise<ActionResult> {
  return call("assignConsignmentThreadAction", thread(submissionId, "/assign"), {
    method: "POST",
    body,
  });
}

export async function closeConsignmentThreadAction(submissionId: string): Promise<ActionResult> {
  return call("closeConsignmentThreadAction", thread(submissionId, "/close"), { method: "POST" });
}

export async function reopenConsignmentThreadAction(submissionId: string): Promise<ActionResult> {
  return call("reopenConsignmentThreadAction", thread(submissionId, "/reopen"), {
    method: "POST",
  });
}

export async function markConsignmentThreadReadAction(submissionId: string): Promise<ActionResult> {
  return call("markConsignmentThreadReadAction", thread(submissionId, "/read"), {
    method: "POST",
  });
}

export async function markConsignmentThreadUnreadAction(
  submissionId: string,
): Promise<ActionResult> {
  return call("markConsignmentThreadUnreadAction", thread(submissionId, "/unread"), {
    method: "POST",
  });
}

export async function bulkConsignmentThreadsAction(
  body: ConsignmentInboxBulkBody,
): Promise<ActionResult<ConsignmentInboxBulkResult>> {
  return call("bulkConsignmentThreadsAction", `${THREADS}/bulk`, { method: "POST", body });
}

/** The colleagues a thread can go to, with how many open threads each has. */
export async function listConsignmentAssigneesAction(): Promise<
  ActionResult<ConsignmentAssignableStaff[]>
> {
  return call("listConsignmentAssigneesAction", `${THREADS}/assignees`, { method: "GET" });
}

export async function listSavedRepliesAction(): Promise<ActionResult<SavedReplyView[]>> {
  return call("listSavedRepliesAction", SAVED_REPLIES, { method: "GET" });
}

export async function createSavedReplyAction(
  body: SavedReplyBody,
): Promise<ActionResult<SavedReplyView>> {
  return call("createSavedReplyAction", SAVED_REPLIES, { method: "POST", body });
}

export async function updateSavedReplyAction(
  id: string,
  body: SavedReplyBody,
): Promise<ActionResult<SavedReplyView>> {
  return call("updateSavedReplyAction", `${SAVED_REPLIES}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

export async function deleteSavedReplyAction(id: string): Promise<ActionResult> {
  return call("deleteSavedReplyAction", `${SAVED_REPLIES}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
