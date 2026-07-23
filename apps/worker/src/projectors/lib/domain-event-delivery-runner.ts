import type {
  DomainEventDeliveryRow,
  IDomainEventDeliveryRepository,
} from "@auction/persistence/interfaces";
import {
  classifyDeliveryError,
  computeDeliveryBackoffMs,
  formatDeliveryError,
} from "../../lib/delivery-retry.js";

export type DomainEventDeliveryOutcome =
  | { ok: true; providerReference?: string | null }
  | { ok: false; error: unknown };

export type RunDomainEventDeliveryOptions = {
  delivery: DomainEventDeliveryRow;
  repo: IDomainEventDeliveryRepository;
  leaseMs: number;
  maxAttempts?: number;
  deliver: () => Promise<DomainEventDeliveryOutcome | undefined>;
  now?: Date;
};

const DEFAULT_MAX_ATTEMPTS = 12;

function withOptionalNow(now?: Date): { now?: Date } {
  return now === undefined ? {} : { now };
}

/**
 * Runs a single consumer delivery under an exclusive processing lease.
 * Handles success, retry scheduling, and dead-letter on fatal/max attempts.
 */
export async function runDomainEventDelivery(
  options: RunDomainEventDeliveryOptions,
): Promise<void> {
  const { delivery, repo, leaseMs } = options;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const renewEveryMs = Math.max(5_000, Math.floor(leaseMs / 3));
  let renewTimer: NodeJS.Timeout | undefined;

  try {
    renewTimer = setInterval(() => {
      void repo.renewLease({ deliveryId: delivery.id, leaseMs });
    }, renewEveryMs);

    const outcome = await options.deliver();
    if (outcome && "ok" in outcome && outcome.ok === false) {
      throw outcome.error;
    }

    const providerReference =
      outcome && typeof outcome === "object" && "ok" in outcome && outcome.ok
        ? (outcome.providerReference ?? null)
        : null;

    await repo.markSucceeded({
      deliveryId: delivery.id,
      providerReference,
      ...withOptionalNow(options.now),
    });
  } catch (err) {
    const message = formatDeliveryError(err);
    const classification = classifyDeliveryError(err);
    const attemptsAfterClaim = delivery.attempts;

    if (classification === "fatal" || attemptsAfterClaim >= maxAttempts) {
      await repo.deadLetter({
        deliveryId: delivery.id,
        lastError: message,
        ...withOptionalNow(options.now),
      });
      return;
    }

    const delayMs = computeDeliveryBackoffMs(attemptsAfterClaim);
    const nextRetryAt = new Date((options.now ?? new Date()).getTime() + delayMs);
    await repo.scheduleRetry({
      deliveryId: delivery.id,
      nextRetryAt,
      lastError: message,
      ...withOptionalNow(options.now),
    });
  } finally {
    if (renewTimer) clearInterval(renewTimer);
  }
}

export type ClaimAndRunDomainEventDeliveriesOptions = {
  consumer: string;
  batchSize: number;
  leaseMs: number;
  repo: IDomainEventDeliveryRepository;
  deliverOne: (row: DomainEventDeliveryRow) => Promise<DomainEventDeliveryOutcome | undefined>;
  now?: Date;
};

/** Claims a batch then runs each delivery with lease-aware wrapping. */
export async function claimAndRunDomainEventDeliveries(
  options: ClaimAndRunDomainEventDeliveriesOptions,
): Promise<number> {
  const claimed = await options.repo.claim({
    consumer: options.consumer,
    batchSize: options.batchSize,
    leaseMs: options.leaseMs,
    ...withOptionalNow(options.now),
  });

  for (const row of claimed) {
    await runDomainEventDelivery({
      delivery: row,
      repo: options.repo,
      leaseMs: options.leaseMs,
      deliver: () => options.deliverOne(row),
      ...withOptionalNow(options.now),
    });
  }

  return claimed.length;
}
