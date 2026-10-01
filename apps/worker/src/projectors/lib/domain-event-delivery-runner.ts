import type {
  DomainEventDeliveryRow,
  IDomainEventDeliveryRepository,
} from "@auction/persistence/interfaces";
import { recordDeliveryOutcome } from "../../lib/delivery-metrics.js";
import {
  classifyDeliveryError,
  computeDeliveryBackoffMs,
  formatDeliveryError,
  isCircuitOpenDeliveryError,
  readRetryAfterMs,
} from "../../lib/delivery-retry.js";

export type DomainEventDeliveryOutcome =
  | { ok: true; providerReference?: string | null }
  | { ok: false; error: unknown }
  | { skipped: true; reason: string; providerReference?: string | null };

export type RunDomainEventDeliveryOptions = {
  delivery: DomainEventDeliveryRow;
  repo: IDomainEventDeliveryRepository;
  leaseMs: number;
  maxAttempts?: number;
  deliver: () => Promise<DomainEventDeliveryOutcome | undefined>;
  now?: Date;
  /** When set, dead-letter metrics use this consumer label. */
  metricsConsumer?: string;
  /** Optional hook after a delivery is moved to dead-letter (e.g. ops email). */
  onDeadLetter?: (input: {
    delivery: DomainEventDeliveryRow;
    lastError: string;
  }) => Promise<void>;
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

    if (outcome && "skipped" in outcome && outcome.skipped) {
      await repo.markSkipped({
        deliveryId: delivery.id,
        reason: outcome.reason,
        providerReference: outcome.providerReference ?? null,
        ...withOptionalNow(options.now),
      });
      return;
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
      if (options.metricsConsumer) {
        recordDeliveryOutcome(options.metricsConsumer, "dead_letter");
      }
      if (options.onDeadLetter) {
        await options.onDeadLetter({ delivery, lastError: message });
      }
      return;
    }

    const retryAfterMs = readRetryAfterMs(err);
    const delayMs = computeDeliveryBackoffMs(attemptsAfterClaim, {
      floorMs: retryAfterMs ?? 0,
    });
    const nextRetryAt = new Date((options.now ?? new Date()).getTime() + delayMs);
    await repo.scheduleRetry({
      deliveryId: delivery.id,
      nextRetryAt,
      lastError: message,
      undoAttemptIncrement: isCircuitOpenDeliveryError(err),
      ...withOptionalNow(options.now),
    });
    if (options.metricsConsumer) {
      recordDeliveryOutcome(options.metricsConsumer, "retry");
    }
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
  /** Record delivery attempt outcomes (success/retry/dead_letter) for this consumer. */
  metricsConsumer?: string;
  onDeadLetter?: RunDomainEventDeliveryOptions["onDeadLetter"];
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
      ...(options.metricsConsumer !== undefined
        ? { metricsConsumer: options.metricsConsumer }
        : {}),
      ...(options.onDeadLetter !== undefined ? { onDeadLetter: options.onDeadLetter } : {}),
      ...withOptionalNow(options.now),
    });
  }

  return claimed.length;
}

export type ClaimAndRunDomainEventDeliveriesWithBudgetOptions =
  ClaimAndRunDomainEventDeliveriesOptions & {
    timeBudgetMs: number;
  };

/** Runs deliveries until the batch is exhausted or the time budget elapses. */
export async function claimAndRunDomainEventDeliveriesWithBudget(
  options: ClaimAndRunDomainEventDeliveriesWithBudgetOptions,
): Promise<number> {
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < options.timeBudgetMs) {
    const claimed = await options.repo.claim({
      consumer: options.consumer,
      batchSize: 1,
      leaseMs: options.leaseMs,
      ...withOptionalNow(options.now),
    });
    if (claimed.length === 0) break;
    for (const row of claimed) {
      if (Date.now() - started >= options.timeBudgetMs) break;
      await runDomainEventDelivery({
        delivery: row,
        repo: options.repo,
        leaseMs: options.leaseMs,
        deliver: () => options.deliverOne(row),
        ...(options.metricsConsumer !== undefined
          ? { metricsConsumer: options.metricsConsumer }
          : {}),
        ...(options.onDeadLetter !== undefined ? { onDeadLetter: options.onDeadLetter } : {}),
        ...withOptionalNow(options.now),
      });
      processed += 1;
    }
  }
  return processed;
}
