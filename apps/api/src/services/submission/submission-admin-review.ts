import { canTransition, transitionErrorMessage } from "@auction/domain";
import type { ItemSubmission } from "@auction/types";
import { type UserRole, canAccessAdminSubmissionsRead } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

export async function assignForAdmin(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
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
    const staffRoles =
      role === "staff" && deps.staffRoles
        ? await deps.staffRoles.listActiveRoles(assignedToUserId, new Date())
        : [];
    if (!canAccessAdminSubmissionsRead(role, staffRoles)) {
      return err(new SubmissionError("Assignee must be staff with submissions access", 400));
    }
  }
  if (deps.consignmentAssignment) {
    // The thread and the consignment move together, and the thread's history shows it.
    await deps.consignmentAssignment.assign(adminId, id, {
      assignedToUserId: assignedToUserId || null,
      covering: false,
    });
    const reloaded = await deps.submissions.findById(id);
    return reloaded ? ok(reloaded) : err(new SubmissionError("Not found", 404));
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
