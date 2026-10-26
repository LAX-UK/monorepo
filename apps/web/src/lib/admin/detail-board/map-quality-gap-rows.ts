import type { DetailQualityGapRow } from "@/lib/admin/detail-board/types";
import type { SubmissionQualityCheck } from "@auction/domain";

const GAP_MESSAGES: Partial<Record<string, string>> = {
  title: "Add a catalogue title before review.",
  category: "Assign at least one category.",
  images: "Upload at least one catalogue image.",
  "images-recommended": "Add more images for a stronger listing.",
  description: "Add a catalogue description for bidders.",
  provenance: "Document provenance for staff review.",
  signature: "Signature not clearly visible in any provided image. Request a detail capture.",
  dimensions: "Dimensions listed in inches only. Add centimeter measurements for EU listings.",
  medium: "Medium is missing or incomplete.",
};

export function mapSubmissionQualityCheckToGapRow(
  check: SubmissionQualityCheck,
): DetailQualityGapRow {
  return {
    id: check.id,
    field: check.label,
    message: GAP_MESSAGES[check.id] ?? `${check.label} needs attention.`,
    severity: check.severity,
  };
}

export function mapSubmissionQualityChecksToGapRows(
  checks: readonly SubmissionQualityCheck[],
): DetailQualityGapRow[] {
  return checks.filter((c) => !c.ok).map(mapSubmissionQualityCheckToGapRow);
}
