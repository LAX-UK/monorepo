import type { ItemSubmission } from "@auction/types";

export type SubmissionQualityCheck = {
  id: string;
  label: string;
  ok: boolean;
  severity: "required" | "warning";
};

export type SubmissionQualityResult = {
  checks: SubmissionQualityCheck[];
  canSubmit: boolean;
  canAccept: boolean;
};

/** Mandatory + advisory checks shared by seller submit gate and staff accept panel. */
export function evaluateSubmissionQuality(
  submission: Pick<
    ItemSubmission,
    "title" | "images" | "description" | "provenance" | "categoryId" | "categoryIds"
  >,
): SubmissionQualityResult {
  const hasCategory =
    (submission.categoryIds?.length ?? 0) > 0 || Boolean(submission.categoryId?.trim());
  const checks: SubmissionQualityCheck[] = [
    {
      id: "title",
      label: "Title",
      ok: Boolean(submission.title?.trim()),
      severity: "required",
    },
    {
      id: "category",
      label: "Category",
      ok: hasCategory,
      severity: "required",
    },
    {
      id: "images",
      label: "At least one image",
      ok: submission.images.length >= 1,
      severity: "required",
    },
    {
      id: "images-recommended",
      label: "Three or more images (recommended)",
      ok: submission.images.length >= 3,
      severity: "warning",
    },
    {
      id: "description",
      label: "Catalogue description",
      ok: Boolean(submission.description?.trim()),
      severity: "warning",
    },
    {
      id: "provenance",
      label: "Provenance notes",
      ok: (submission.provenance?.length ?? 0) > 0,
      severity: "warning",
    },
  ];

  const requiredOk = checks.filter((c) => c.severity === "required").every((c) => c.ok);
  return {
    checks,
    canSubmit: requiredOk,
    canAccept: requiredOk,
  };
}

/** Staff triage: missing required fields or advisory gaps (photos, description, provenance). */
export function submissionHasQualityGaps(
  submission: Pick<
    ItemSubmission,
    "title" | "images" | "description" | "provenance" | "categoryId" | "categoryIds"
  >,
): boolean {
  const quality = evaluateSubmissionQuality(submission);
  if (!quality.canAccept) return true;
  return quality.checks.some((c) => c.severity === "warning" && !c.ok);
}
