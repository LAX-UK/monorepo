import { NOTIFICATION_OUTBOX_CLAIM_GUARD_MS } from "@auction/persistence/lib";

/** Job name for on-demand drains on the notification outbox queue (the minute sweep keeps its own). */
export const NOTIFICATION_OUTBOX_WAKE_JOB_NAME = "process-notification-outbox-wake";

/** Wakes within one bucket share a job, so a burst of commits costs one drain, not one each. */
export const WAKE_BUCKET_MS = 250;

/**
 * The follow-up drain runs once every row committed with the wake is past the outbox claim guard
 * ({@link NOTIFICATION_OUTBOX_CLAIM_GUARD_MS}: a drain that runs the instant a row commits can find
 * it not yet claimable): the guard, plus the bucket width (two wakes can share a follow-up up to one bucket apart), rounded up
 * to whole buckets so wakes that share an immediate drain also share its follow-up.
 */
export const WAKE_SETTLE_DELAY_MS = NOTIFICATION_OUTBOX_CLAIM_GUARD_MS + 2 * WAKE_BUCKET_MS;

export type EnqueueWakeJob = (job: { jobId: string; delayMs: number }) => Promise<void>;

/**
 * Turns "a critical notification was committed" signals into outbox drain jobs.
 *
 * Every wake asks for an immediate drain and a follow-up drain after {@link WAKE_SETTLE_DELAY_MS}.
 * Job ids are derived from the time bucket the drain is due in, so every worker replica that hears
 * the same signal, and every signal in the same bucket, maps to the same job: the queue keeps one,
 * which caps drains at a few per second however many bids land (back-pressure), while the minute
 * sweep stays the safety net for anything a lost signal leaves behind.
 */
export class NotificationOutboxWakeScheduler {
  constructor(
    private readonly deps: {
      enqueue: EnqueueWakeJob;
      onError: (err: unknown) => void;
      now?: () => number;
    },
  ) {}

  wake(): void {
    const now = (this.deps.now ?? Date.now)();
    this.schedule("now", now, 0);
    this.schedule("settle", now, WAKE_SETTLE_DELAY_MS);
  }

  private schedule(kind: "now" | "settle", now: number, delayMs: number): void {
    const bucket = Math.floor((now + delayMs) / WAKE_BUCKET_MS);
    const jobId = `${NOTIFICATION_OUTBOX_WAKE_JOB_NAME}-${kind}-${bucket}`;
    this.deps.enqueue({ jobId, delayMs }).catch((err) => this.deps.onError(err));
  }
}
