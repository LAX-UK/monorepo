import type { Clock } from "../ports/clock";
import type { StaffToolsAccess, StaffToolsAnswer } from "../ports/staff-tools-access";

export type CachedStaffToolsAccessOptions = {
  clock: Clock;
  /** How long a good answer is reused. Short, so a revoked role stops being offered quickly. */
  ttlMs: number;
  /** How long a failure is remembered, so an outage is not retried on every page render. */
  failureTtlMs: number;
  maxEntries?: number;
};

type Entry = { answer: StaffToolsAnswer; expiresAtMs: number };

/** Remembers each person's answer for a short while, per server instance. */
export function createCachedStaffToolsAccess(
  inner: StaffToolsAccess,
  options: CachedStaffToolsAccessOptions,
): StaffToolsAccess {
  const entries = new Map<string, Entry>();
  const maxEntries = options.maxEntries ?? 500;
  return {
    async toolsFor(caller) {
      const subjectId = caller.subjectId;
      const hit = entries.get(subjectId);
      if (hit && hit.expiresAtMs > options.clock.nowMs()) return hit.answer;
      const answer = await inner.toolsFor(caller);
      const oldest = entries.keys().next();
      if (entries.size >= maxEntries && !oldest.done) entries.delete(oldest.value);
      entries.set(subjectId, {
        answer,
        expiresAtMs:
          options.clock.nowMs() + (answer.status === "ok" ? options.ttlMs : options.failureTtlMs),
      });
      return answer;
    },
  };
}
