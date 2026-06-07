import { evaluateSubmissionQuality } from "@auction/domain";
import type { ItemSubmission } from "@auction/types";

export type SubmissionQualityWarningInput = Pick<
  ItemSubmission,
  "title" | "images" | "description" | "provenance" | "categoryId" | "categoryIds"
>;

/** Advisory labels for staff queue triage (description, provenance, photo count). */
export function submissionQualityWarnings(submission: SubmissionQualityWarningInput): string[] {
  const { checks } = evaluateSubmissionQuality(submission);
  return checks.filter((c) => c.severity === "warning" && !c.ok).map((c) => c.label);
}

export function submissionHasQualityGaps(submission: SubmissionQualityWarningInput): boolean {
  return submissionQualityWarnings(submission).length > 0;
}

export function submissionBlocksAccept(submission: SubmissionQualityWarningInput): boolean {
  return !evaluateSubmissionQuality(submission).canAccept;
}
