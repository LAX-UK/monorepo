import "server-only";

import { fetchConsignmentThread } from "@/lib/data/http/consignment-inbox.server";
import type { ConsignmentThreadDetail } from "@auction/validators";

export type SubmissionMessagesPageModel =
  | { kind: "ready"; detail: ConsignmentThreadDetail }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/** Data/composition boundary for `/admin/submissions/[id]/messages`. */
export async function loadAdminSubmissionMessagesPage(
  submissionId: string,
): Promise<SubmissionMessagesPageModel> {
  const thread = await fetchConsignmentThread(submissionId);
  if (thread.ok) return { kind: "ready", detail: thread.data };
  return thread.reason === "not_found" ? { kind: "not_found" } : { kind: "unavailable" };
}

/** The Messages tab's count: client messages nobody at LAX has read; none when it fails. */
export async function loadSubmissionUnreadMessages(submissionId: string): Promise<number> {
  const thread = await fetchConsignmentThread(submissionId).catch(() => null);
  return thread?.ok ? thread.data.unread : 0;
}
