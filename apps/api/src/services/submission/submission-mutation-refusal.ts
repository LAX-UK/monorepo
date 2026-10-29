import type { SubmissionMutationAccess } from "../interfaces/submission-routes/submission-access.js";
import type { SubmissionHttpJson } from "../interfaces/submission-routes/submission-route-http.js";

/** Stable code for a change the member's role, or their relation to the submission, refuses. */
export const SUBMISSION_CHANGE_NOT_ALLOWED = "submission_change_not_allowed";

/** The HTTP answer for a refused change, or `null` when the change may go ahead. */
export function mutationRefusal(access: SubmissionMutationAccess): SubmissionHttpJson | null {
  switch (access.kind) {
    case "allowed":
      return null;
    case "not_found":
      return { status: 404, body: { error: "Not found" } };
    case "forbidden":
      return { status: 403, body: { error: access.message, code: SUBMISSION_CHANGE_NOT_ALLOWED } };
  }
}
