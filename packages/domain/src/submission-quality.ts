import type { ItemSubmission } from "@auction/types";

export type SubmissionQualityCheck = {
  id: string;
  label: string;
  /** Actionable copy for review drawers when the check fails. */
  description: string;
  ok: boolean;
  severity: "required" | "warning";
};

const QUALITY_CHECK_COPY: Record<string, { label: string; description: string }> = {
  title: {
    label: "Title",
    description: "Add a catalogue title before this submission can be accepted.",
  },
  category: {
    label: "Category",
    description: "Select at least one category so the item can be catalogued.",
  },
  images: {
    label: "At least one image",
    description: "Upload at least one photograph of the work.",
  },
  "images-recommended": {
    label: "Three or more images (recommended)",
    description: "Add more angles or detail shots to support condition review.",
  },
  description: {
    label: "Catalogue description",
    description: "Provide a catalogue description for buyers and reviewers.",
  },
  provenance: {
    label: "Provenance notes",
    description: "Document ownership history or source before listing.",
  },
  medium: {
    label: "Medium",
    description: "Specify materials or medium for accurate catalogue entry.",
  },
  dimensions: {
    label: "Dimensions (metric)",
    description: "Dimensions listed in inches only. Add centimeter measurements for EU listings.",
  },
  signature: {
    label: "Signature",
    description: "Signature not clearly visible in any provided image. Request a detail capture.",
  },
};

function qualityCheck(
  id: keyof typeof QUALITY_CHECK_COPY,
  ok: boolean,
  severity: "required" | "warning",
): SubmissionQualityCheck {
  const copy = QUALITY_CHECK_COPY[id];
  if (copy === undefined) {
    throw new Error(`Unknown quality check id: ${id}`);
  }
  return {
    id,
    label: copy.label,
    description: copy.description,
    ok,
    severity,
  };
}

export type SubmissionQualityResult = {
  checks: SubmissionQualityCheck[];
  canSubmit: boolean;
  canAccept: boolean;
};

export type SubmissionQualityInput = Pick<
  ItemSubmission,
  "title" | "images" | "description" | "provenance" | "categoryId" | "categoryIds"
> &
  Partial<Pick<ItemSubmission, "medium" | "dimensions" | "signatureNote">>;

function hasCategory(submission: SubmissionQualityInput): boolean {
  return (submission.categoryIds?.length ?? 0) > 0 || Boolean(submission.categoryId?.trim());
}

function dimensionsIncludeMetric(dimensions: string | null | undefined): boolean {
  const value = dimensions?.trim() ?? "";
  if (!value) return false;
  return /\bcm\b/i.test(value) || /\bcentimet/i.test(value);
}

function signatureDocumented(signatureNote: string | null | undefined): boolean {
  return Boolean(signatureNote?.trim());
}

/** Mandatory + advisory checks shared by seller submit gate and staff accept panel. */
export function evaluateSubmissionQuality(
  submission: SubmissionQualityInput,
): SubmissionQualityResult {
  const checks: SubmissionQualityCheck[] = [
    qualityCheck("title", Boolean(submission.title?.trim()), "required"),
    qualityCheck("category", hasCategory(submission), "required"),
    qualityCheck("images", submission.images.length >= 1, "required"),
    qualityCheck("images-recommended", submission.images.length >= 3, "warning"),
    qualityCheck("description", Boolean(submission.description?.trim()), "warning"),
    qualityCheck("provenance", (submission.provenance?.length ?? 0) > 0, "warning"),
    qualityCheck("medium", Boolean(submission.medium?.trim()), "warning"),
    qualityCheck("dimensions", dimensionsIncludeMetric(submission.dimensions), "warning"),
    qualityCheck("signature", signatureDocumented(submission.signatureNote), "warning"),
  ];

  const requiredOk = checks.filter((c) => c.severity === "required").every((c) => c.ok);
  return {
    checks,
    canSubmit: requiredOk,
    canAccept: requiredOk,
  };
}

/** Staff triage: missing required fields or advisory gaps (photos, description, provenance). */
export function submissionHasQualityGaps(submission: SubmissionQualityInput): boolean {
  const quality = evaluateSubmissionQuality(submission);
  if (!quality.canAccept) return true;
  return quality.checks.some((c) => c.severity === "warning" && !c.ok);
}
