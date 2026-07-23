import type { SubmissionSlaTone } from "@/lib/admin/submission-sla";
import type { SubmissionQualityGapItem } from "@/lib/admin/submissions/submission-quality-presentation";
import type { ItemSubmissionStatus } from "@auction/types";

export type AdminSubmissionTableRow = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  categoryPreview: string | null;
  sellerPreview: string;
  status: ItemSubmissionStatus;
  createdAtIso: string;
  /** @deprecated Prefer createdAtIso with AdminTableDateTimeCell in tables */
  createdAtLabel: string;
  slaDays: number | null;
  slaLabel: string | null;
  slaTone: SubmissionSlaTone | null;
  isOverSla: boolean;
  /** @deprecated Prefer qualityGaps + qualitySummaryLabel */
  qualityWarnings: string[];
  qualityGaps: SubmissionQualityGapItem[];
  qualitySummaryLabel: string | null;
  blocksAccept: boolean;
  assigneeLabel: string;
  assigneeUserId: string | null;
  isAssignedToCurrentUser: boolean;
  isUnassigned: boolean;
};
