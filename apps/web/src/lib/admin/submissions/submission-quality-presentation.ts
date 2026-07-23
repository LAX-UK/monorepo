import { type SubmissionQualityInput, evaluateSubmissionQuality } from "@auction/domain";
import type { SubmissionQualityCheck } from "@auction/domain";

export type SubmissionQualityGapSeverity = "required" | "warning";

export type SubmissionQualityGapItem = {
  id: string;
  label: string;
  description: string;
  severity: SubmissionQualityGapSeverity;
};

export type SubmissionQualityPresentation = {
  gaps: SubmissionQualityGapItem[];
  blocksAccept: boolean;
  hasAdvisoryGaps: boolean;
  summaryLabel: string | null;
};

export type { SubmissionQualityInput } from "@auction/domain";

function toGapItem(check: SubmissionQualityCheck): SubmissionQualityGapItem {
  return {
    id: check.id,
    label: check.label,
    description: check.description,
    severity: check.severity,
  };
}

/** Typed quality-gap contract shared by queue rows and review workspace. */
export function buildSubmissionQualityPresentation(
  submission: SubmissionQualityInput,
): SubmissionQualityPresentation {
  const { checks, canAccept } = evaluateSubmissionQuality(submission);
  const gaps = checks.filter((c) => !c.ok).map(toGapItem);
  const requiredGaps = gaps.filter((g) => g.severity === "required");
  const advisoryGaps = gaps.filter((g) => g.severity === "warning");
  const hasAdvisoryGaps = advisoryGaps.length > 0;

  let summaryLabel: string | null = null;
  if (requiredGaps.length > 0) {
    const firstRequired = requiredGaps.at(0);
    summaryLabel =
      requiredGaps.length === 1 && firstRequired
        ? firstRequired.label
        : `${requiredGaps.length} required gaps`;
  } else if (advisoryGaps.length > 0) {
    const firstAdvisory = advisoryGaps.at(0);
    summaryLabel =
      advisoryGaps.length === 1 && firstAdvisory
        ? firstAdvisory.label
        : `${advisoryGaps.length} quality notes`;
  }

  return {
    gaps,
    blocksAccept: !canAccept,
    hasAdvisoryGaps,
    summaryLabel,
  };
}

export function submissionQualityWarningLabels(
  presentation: SubmissionQualityPresentation,
): string[] {
  return presentation.gaps.filter((g) => g.severity === "warning").map((g) => g.label);
}
