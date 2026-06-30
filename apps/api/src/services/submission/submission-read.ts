import type { ItemSubmission } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { ListSubmissionsFilter } from "../interfaces/repositories.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

export async function listForSeller(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  f: ListSubmissionsFilter,
): Promise<ItemSubmission[]> {
  return deps.submissions.listForLegalEntity(legalEntityId, f);
}

export async function getForSeller(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  id: string,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const s = await deps.submissions.findById(id);
  if (!s || s.legalEntityId !== legalEntityId) return err(new SubmissionError("Not found", 404));
  return ok(s);
}

export async function listForAdmin(
  deps: ItemSubmissionServiceDeps,
  f: ListSubmissionsFilter,
): Promise<ItemSubmission[]> {
  return deps.submissions.listForAdmin(f);
}

export async function getForAdmin(
  deps: ItemSubmissionServiceDeps,
  id: string,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const s = await deps.submissions.findById(id);
  if (!s) return err(new SubmissionError("Not found", 404));
  return ok(s);
}

export function countPendingForAdmin(
  deps: ItemSubmissionServiceDeps,
  f: Omit<ListSubmissionsFilter, "limit" | "offset">,
): Promise<number> {
  return deps.submissions.countAdmin(f);
}
