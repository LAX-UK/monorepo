import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";
import type {
  ConsignmentAssignableStaff,
  ConsignmentInboxListResponse,
  ConsignmentInboxSummary,
  ConsignmentThreadDetail,
  SavedReplyView,
} from "@auction/validators";
import { cache } from "react";

/**
 * Reads for the Bid admin inbox (`/admin/consignment-threads`). Each answers the data, or why it
 * is missing, so pages can keep their frame and say what went wrong.
 */
export type InboxRead<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; reason: "forbidden" | "not_found" | "unavailable" };

async function read<T>(path: string, pick: (body: unknown) => T | null): Promise<InboxRead<T>> {
  const res = await authedServerFetch(path).catch(() => null);
  if (!res) return { ok: false, status: 0, reason: "unavailable" };
  if (res.status === 403) return { ok: false, status: 403, reason: "forbidden" };
  if (res.status === 404) return { ok: false, status: 404, reason: "not_found" };
  if (!res.ok) return { ok: false, status: res.status, reason: "unavailable" };
  const body = await readJsonBody(res).catch(() => null);
  const data = pick(body);
  return data === null ? { ok: false, status: 502, reason: "unavailable" } : { ok: true, data };
}

function dataOf<T>(body: unknown): T | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  return (body as { data: T }).data ?? null;
}

/** The list page: rows, total, the view and sort applied and the filter counts. */
export function fetchConsignmentInbox(
  query: URLSearchParams,
): Promise<InboxRead<ConsignmentInboxListResponse>> {
  const search = query.toString();
  return read(`/admin/consignment-threads${search ? `?${search}` : ""}`, (body) =>
    body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
      ? (body as ConsignmentInboxListResponse)
      : null,
  );
}

/** The counts behind the view tabs, the sidebar and the Dashboard queues; once per request. */
export const fetchConsignmentInboxSummary = cache(
  (): Promise<InboxRead<ConsignmentInboxSummary>> =>
    read("/admin/consignment-threads/summary", (body) => dataOf<ConsignmentInboxSummary>(body)),
);

/** One thread with its facts; shared by a consignment's layout (its tab count) and its tab. */
export const fetchConsignmentThread = cache(
  (submissionId: string): Promise<InboxRead<ConsignmentThreadDetail>> =>
    read(`/admin/consignment-threads/${encodeURIComponent(submissionId)}`, (body) =>
      dataOf<ConsignmentThreadDetail>(body),
    ),
);

export function fetchConsignmentAssignees(): Promise<InboxRead<ConsignmentAssignableStaff[]>> {
  return read("/admin/consignment-threads/assignees", (body) =>
    dataOf<ConsignmentAssignableStaff[]>(body),
  );
}

export function fetchSavedReplies(): Promise<InboxRead<SavedReplyView[]>> {
  return read("/admin/consignment-saved-replies", (body) => dataOf<SavedReplyView[]>(body));
}
