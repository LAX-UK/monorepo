import type { Database } from "@auction/db";
import { marketingEventOutbox } from "@auction/db/schema";
import {
  type IUserIdentityResolver,
  type SgtmMarketingEventPublisher,
  mergeClientContextIntoUserData,
} from "@auction/marketing-events";
import type { MarketingEvent, PublishOutcome, ResolvedMarketingEvent } from "@auction/types";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import { Counter } from "prom-client";
import type { WorkerEnv } from "../env.js";
import { isMarketingEventsEnabled } from "../lib/marketing-events-enabled.js";
import {
  MARKETING_OUTBOX_MAX_ATTEMPTS,
  claimMarketingEventOutbox,
  claimSingleOutboxRow,
} from "../marketing/outbox-claim.js";

export const marketingEventsOutcomeTotal = new Counter({
  name: "marketing_events_outcome_total",
  help: "Marketing event publish outcomes",
  labelNames: ["name", "vendor", "outcome"] as const,
});

export type MarketingEventProcessorDeps = {
  db: Database;
  env: WorkerEnv;
  log: Logger;
  identityResolver: IUserIdentityResolver;
  sgtmPublisher: SgtmMarketingEventPublisher;
  enqueueCapiBatch: (event: ResolvedMarketingEvent) => Promise<void>;
};

export async function applyMarketingPublishOutcome(input: {
  db: Database;
  env: WorkerEnv;
  log: Logger;
  event: MarketingEvent;
  outcome: PublishOutcome;
}): Promise<void> {
  const { db, env, log, event, outcome } = input;

  if (outcome.status === "sent") {
    marketingEventsOutcomeTotal.inc({
      name: event.name,
      vendor: outcome.vendor,
      outcome: "sent",
    });
    await db
      .update(marketingEventOutbox)
      .set({ state: "sent", sentAt: new Date(), lastError: null })
      .where(eq(marketingEventOutbox.eventId, event.eventId));
    log.info(
      { eventId: event.eventId, name: event.name, vendor: outcome.vendor },
      "marketing event sent",
    );
    return;
  }

  if (outcome.status === "skipped") {
    marketingEventsOutcomeTotal.inc({
      name: event.name,
      vendor: "skipped",
      outcome: "dropped_consent",
    });
    await db
      .update(marketingEventOutbox)
      .set({ state: "skipped", lastError: outcome.reason, sentAt: null, claimedAt: null })
      .where(eq(marketingEventOutbox.eventId, event.eventId));
    return;
  }

  const [row] = await db
    .select()
    .from(marketingEventOutbox)
    .where(eq(marketingEventOutbox.eventId, event.eventId))
    .limit(1);

  const nextAttempts = (row?.attempts ?? 0) + 1;
  const attemptsExceeded = nextAttempts >= MARKETING_OUTBOX_MAX_ATTEMPTS;
  const retryable = outcome.retryable && !attemptsExceeded;

  marketingEventsOutcomeTotal.inc({
    name: event.name,
    vendor: "meta_capi",
    outcome: attemptsExceeded
      ? "failed_permanent_attempts_exceeded"
      : retryable
        ? "failed_retry"
        : "failed_permanent",
  });

  if (row) {
    await db
      .update(marketingEventOutbox)
      .set({
        state: retryable ? "pending" : "failed",
        lastError: outcome.error.slice(0, 2000),
        attempts: nextAttempts,
        claimedAt: null,
      })
      .where(eq(marketingEventOutbox.id, row.id));
  }

  if (attemptsExceeded && env.SENTRY_DSN_WORKER) {
    const Sentry = await import("@sentry/node");
    Sentry.captureMessage(`marketing_event_attempts_exceeded:${event.name}`, {
      level: "warning",
      extra: { eventId: event.eventId, attempts: nextAttempts, error: outcome.error },
    });
  }

  if (!retryable && env.SENTRY_DSN_WORKER) {
    const Sentry = await import("@sentry/node");
    Sentry.captureMessage(`marketing_event_failed_permanent:${event.name}`, {
      level: "error",
      extra: { eventId: event.eventId, error: outcome.error },
    });
  }

  if (retryable) {
    throw new Error(outcome.error);
  }
}

export async function processMarketingEventJob(
  deps: MarketingEventProcessorDeps,
  event: MarketingEvent,
): Promise<void> {
  const { db, env, log, identityResolver, sgtmPublisher, enqueueCapiBatch } = deps;

  if (!isMarketingEventsEnabled(env)) return;

  // Prevent duplicate delivery: the outbox poller may also pick up this row
  // if the BullMQ job takes >60s (e.g. slow Meta, retry storm). Claim the row
  // first; if claiming fails the row is already being processed by the poller
  // or has reached a terminal state — skip to avoid double-publishing.
  const claimed = await claimSingleOutboxRow(db, event.eventId);
  if (!claimed) {
    log.debug(
      { eventId: event.eventId },
      "marketing event row already claimed or terminal — skipping",
    );
    return;
  }

  const userData = mergeClientContextIntoUserData(
    await identityResolver.resolve(event.userIdOrAnon),
    event.clientContext,
  );
  const resolved: ResolvedMarketingEvent = { ...event, userData };

  if (event.actionSource !== "system_generated") {
    const sgtmOutcome = await sgtmPublisher.publish(resolved);
    if (sgtmOutcome.status === "sent" || sgtmOutcome.status === "skipped") {
      await applyMarketingPublishOutcome({ db, env, log, event, outcome: sgtmOutcome });
      return;
    }
  }

  await enqueueCapiBatch(resolved);
}

export async function runMarketingEventOutboxPoller(input: {
  db: Database;
  log: Logger;
  enqueue: (event: MarketingEvent) => Promise<void>;
}): Promise<number> {
  const events = await claimMarketingEventOutbox(input.db, 100);
  for (const event of events) {
    await input.enqueue(event);
  }
  if (events.length > 0) {
    input.log.info({ count: events.length }, "marketing outbox poller re-enqueued");
  }
  return events.length;
}
