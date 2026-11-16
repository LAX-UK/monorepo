import { NOTIFICATION_OUTBOX_CLAIM_GUARD_MS } from "@auction/persistence/lib";
import { describe, expect, it, vi } from "vitest";
import {
  NOTIFICATION_OUTBOX_WAKE_JOB_NAME,
  NotificationOutboxWakeScheduler,
  WAKE_BUCKET_MS,
  WAKE_SETTLE_DELAY_MS,
} from "./notification-outbox-wake-scheduler.js";

function setup(startAt = 1_000_000) {
  let now = startAt;
  const jobs: Array<{ jobId: string; delayMs: number }> = [];
  const onError = vi.fn();
  const scheduler = new NotificationOutboxWakeScheduler({
    enqueue: async (job) => {
      jobs.push(job);
    },
    onError,
    now: () => now,
  });
  return {
    scheduler,
    jobs,
    onError,
    advance: (ms: number) => {
      now += ms;
    },
    ids: () => new Set(jobs.map((j) => j.jobId)),
  };
}

describe("NotificationOutboxWakeScheduler", () => {
  it("asks for an immediate drain and a follow-up once the claim guard has passed", () => {
    const { scheduler, jobs } = setup();
    scheduler.wake();
    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.delayMs).toBe(0);
    expect(jobs[1]?.delayMs).toBe(WAKE_SETTLE_DELAY_MS);
    for (const job of jobs)
      expect(job.jobId.startsWith(NOTIFICATION_OUTBOX_WAKE_JOB_NAME)).toBe(true);
  });

  it("gives every wake in one bucket the same job ids, so a burst costs one drain", () => {
    const { scheduler, ids, advance } = setup(10 * WAKE_BUCKET_MS);
    for (let i = 0; i < 20; i++) {
      scheduler.wake();
      advance(Math.floor((WAKE_BUCKET_MS - 1) / 20));
    }
    expect(ids().size).toBe(2);
  });

  it("gives wakes from different replicas at the same moment the same job ids", () => {
    const a = setup(5_000_123);
    const b = setup(5_000_123);
    a.scheduler.wake();
    b.scheduler.wake();
    expect([...a.ids()]).toEqual([...b.ids()]);
  });

  it("starts new jobs in the next bucket, so a commit after a drain is never absorbed by it", () => {
    const { scheduler, ids, advance } = setup(10 * WAKE_BUCKET_MS);
    scheduler.wake();
    advance(WAKE_BUCKET_MS);
    scheduler.wake();
    expect(ids().size).toBe(4);
  });

  it("runs the follow-up after the claim guard for any wake that shares it", () => {
    // Two wakes share a follow-up job only when their follow-ups fall in the same bucket; the
    // follow-up runs at the earlier one's due time, which must still clear the later wake's guard.
    expect(WAKE_SETTLE_DELAY_MS - WAKE_BUCKET_MS).toBeGreaterThan(
      NOTIFICATION_OUTBOX_CLAIM_GUARD_MS,
    );
  });

  it("reports an enqueue failure instead of throwing (the minute sweep still runs)", async () => {
    const onError = vi.fn();
    const scheduler = new NotificationOutboxWakeScheduler({
      enqueue: async () => {
        throw new Error("redis down");
      },
      onError,
    });
    expect(() => scheduler.wake()).not.toThrow();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
  });
});
