import type { FailedJobSummary } from "@auction/types";

/** Failures that read the same, shown as one row with a count. */
export type FailedJobGroup = FailedJobSummary & {
  /** Every failure in the group, in the order the list gave them. The first stands for the row. */
  members: FailedJobSummary[];
};

/** Two failures are identical when the same kind of job or delivery failed with the same error. */
function groupKey(job: FailedJobSummary): string {
  return [job.source, job.queue, job.jobLabel ?? "", job.state, job.errorSummary].join("\u0000");
}

/**
 * Folds identical failures on a page into one row each, in the order of their first appearance.
 * A group opens its first failure, and any decision on it applies to every member. Its retry is
 * offered if any member can be retried; the members that cannot are reported by the retry itself.
 */
export function groupFailedJobs(rows: readonly FailedJobSummary[]): FailedJobGroup[] {
  const groups = new Map<string, FailedJobSummary[]>();
  for (const row of rows) {
    const key = groupKey(row);
    const members = groups.get(key);
    if (members) members.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()].map((members) => {
    const [first] = members as [FailedJobSummary, ...FailedJobSummary[]];
    if (members.length === 1) return { ...first, members };
    const refused = members.find((member) => !member.retry.allowed);
    return {
      ...first,
      attempts: Math.max(...members.map((member) => member.attempts)),
      firstFailedAt: members.reduce(
        (earliest, member) => (member.firstFailedAt < earliest ? member.firstFailedAt : earliest),
        first.firstFailedAt,
      ),
      lastFailedAt: members.reduce(
        (latest, member) => (member.lastFailedAt > latest ? member.lastFailedAt : latest),
        first.lastFailedAt,
      ),
      canAct: members.every((member) => member.canAct),
      mayRepeat: members.some((member) => member.mayRepeat),
      retry:
        members.some((member) => member.retry.allowed) || !refused
          ? { allowed: true }
          : refused.retry,
      members,
    };
  });
}
