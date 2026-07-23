const MS_PER_DAY = 24 * 60 * 60 * 1000;
const OVER_SLA_DAYS = 7;

/** Whole days since submission was created (queue age for awaiting items). */
export function submissionQueueAgeDays(
  createdAt: Date | null | undefined,
  now = Date.now(),
): number {
  if (!createdAt || Number.isNaN(createdAt.getTime())) return 0;
  const elapsed = Math.max(0, now - createdAt.getTime());
  return Math.floor(elapsed / MS_PER_DAY);
}

export function formatQueueAgeCompareHint(
  queueAgeDays: number,
  avgQueueAgeDays: number | null,
): string | undefined {
  if (avgQueueAgeDays == null || avgQueueAgeDays <= 0) {
    return queueAgeDays === 1 ? "1 day waiting" : `${queueAgeDays} days waiting`;
  }
  if (queueAgeDays > avgQueueAgeDays) return "Above avg";
  if (queueAgeDays < avgQueueAgeDays) return "Below avg";
  return "At average wait";
}

export function submissionSlaHoursRemaining(
  updatedAt: Date,
  now = Date.now(),
  slaDays = OVER_SLA_DAYS,
): number | null {
  const deadline = updatedAt.getTime() + slaDays * MS_PER_DAY;
  const remainingMs = deadline - now;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (60 * 60 * 1000));
}

export function formatSubmissionSlaCountdownLabel(hoursRemaining: number): string {
  if (hoursRemaining <= 0) return "Over SLA";
  if (hoursRemaining < 24) return `${hoursRemaining}h left`;
  const days = Math.ceil(hoursRemaining / 24);
  return `${days}d left`;
}

/** Detailed SLA countdown for review drawers (e.g. "4d 17h left"). */
export function formatSubmissionSlaCountdownDetailed(hoursRemaining: number): string {
  if (hoursRemaining <= 0) return "Over SLA";
  if (hoursRemaining < 24) return `${hoursRemaining}h left`;
  const days = Math.floor(hoursRemaining / 24);
  const hours = hoursRemaining % 24;
  if (hours === 0) return `${days}d left`;
  return `${days}d ${hours}h left`;
}

export function submissionIsHighPriority(input: {
  isOverSla: boolean;
  hasRequiredQualityGaps: boolean;
}): boolean {
  return input.isOverSla || input.hasRequiredQualityGaps;
}
