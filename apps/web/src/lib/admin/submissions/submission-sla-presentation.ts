import {
  type SubmissionSlaTone,
  formatSubmissionSlaLabel,
  submissionQueueSlaDays,
  submissionSlaTone,
} from "@/lib/admin/submission-sla";
import type { ItemSubmissionStatus } from "@auction/types";

export type SubmissionSlaPresentation = {
  days: number | null;
  label: string | null;
  tone: SubmissionSlaTone | null;
  isOverSla: boolean;
};

const OVER_SLA_DAYS = 7;

export function buildSubmissionSlaPresentation(input: {
  status: ItemSubmissionStatus;
  updatedAt: Date;
  /** Set once the work became a lot; it then waits on no one. */
  convertedLotId?: string | null | undefined;
  now?: number;
}): SubmissionSlaPresentation {
  const days = submissionQueueSlaDays(
    input.status,
    input.updatedAt,
    input.now,
    input.convertedLotId ?? null,
  );
  if (days == null) {
    return { days: null, label: null, tone: null, isOverSla: false };
  }
  return {
    days,
    label: formatSubmissionSlaLabel(days),
    tone: submissionSlaTone(days),
    isOverSla: days > OVER_SLA_DAYS,
  };
}
