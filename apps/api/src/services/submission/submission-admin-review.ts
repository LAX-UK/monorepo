import { canTransition, transitionErrorMessage } from "@auction/domain";
import type { ItemSubmission } from "@auction/types";
import {
  type UserRole,
  canAccessAdminSubmissionsRead,
  normalizeUserStaffRole,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

export async function assignForAdmin(
  deps: ItemSubmissionServiceDeps,
  _adminId: string,
  id: string,
  assignedToUserId: string | null,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const s = await deps.submissions.findById(id);
  if (!s) return err(new SubmissionError("Not found", 404));
  if (s.status !== "submitted" && s.status !== "under_review") {
    return err(new SubmissionError("Assignment is only allowed while awaiting decision", 400));
  }
  if (assignedToUserId) {
    const assignee = await deps.users.findById(assignedToUserId);
    if (!assignee) return err(new SubmissionError("Assignee not found", 404));
    const role = assignee.role as UserRole;
    if (!canAccessAdminSubmissionsRead(role, normalizeUserStaffRole(assignee.staffRole))) {
      return err(new SubmissionError("Assignee must be staff with submissions access", 400));
    }
  }
  const updated = await deps.submissions.update(id, {
    assignedToUserId: assignedToUserId ?? null,
  });
  return ok(updated);
}

export async function startReview(
  deps: ItemSubmissionServiceDeps,
  _adminId: string,
  id: string,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const s = await deps.submissions.findById(id);
  if (!s) return err(new SubmissionError("Not found", 404));
  if (!canTransition(s.status, "startReview")) {
    return err(new SubmissionError(transitionErrorMessage(s.status, "startReview")));
  }
  const updated = await deps.submissions.update(id, {
    status: "under_review",
    assignedToUserId: _adminId,
  });
  return ok(updated);
}
