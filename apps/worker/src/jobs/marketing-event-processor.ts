import {
  type IUserIdentityResolver,
  type SgtmMarketingEventPublisher,
  mergeClientContextIntoUserData,
} from "@auction/marketing-events";
import { Sentry } from "@auction/observability";
import type { MarketingEvent, PublishOutcome, ResolvedMarketingEvent } from "@auction/types";
import type { Logger } from "pino";
import { Counter } from "prom-client";
import type { WorkerEnv } from "../env.js";
import type { IMarketingEventOutboxWorker } from "../interfaces/marketing-event-outbox.worker.js";
import { isMarketingEventsEnabled } from "../lib/marketing-events-enabled.js";

export const marketingEventsOutcomeTotal = new Counter({
  name: "marketing_events_outcome_total",
  help: "Marketing event publish outcomes",
  labelNames: ["name", "vendor", "outcome"] as const,
});

export type MarketingEventProcessorDeps = {
  marketingEventOutboxWorker: IMarketingEventOutboxWorker;
  env: WorkerEnv;
  log: Logger;
  identityResolver: IUserIdentityResolver;
  sgtmPublisher: SgtmMarketingEventPublisher;
  enqueueCapiBatch: (event: ResolvedMarketingEvent) => Promise<void>;
};

export async function applyMarketingPublishOutcome(input: {
  marketingEventOutboxWorker: IMarketingEventOutboxWorker;
  env: WorkerEnv;
  log: Logger;
  event: MarketingEvent;
  outcome: PublishOutcome;
}): Promise<void> {
  const { marketingEventOutboxWorker, env, log, event, outcome } = input;

  if (outcome.status === "sent") {
    marketingEventsOutcomeTotal.inc({
      name: event.name,
      vendor: outcome.vendor,
      outcome: "sent",
    });
    await marketingEventOutboxWorker.applyPublishOutcome(event, outcome);
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
    await marketingEventOutboxWorker.applyPublishOutcome(event, outcome);
    return;
  }

  const failure = await marketingEventOutboxWorker.applyPublishOutcome(event, outcome);
  if (!failure) return;

  const { nextAttempts, attemptsExceeded, shouldRetry } = failure;

  marketingEventsOutcomeTotal.inc({
    name: event.name,
    vendor: "meta_capi",
    outcome: attemptsExceeded
      ? "failed_permanent_attempts_exceeded"
      : shouldRetry
        ? "failed_retry"
        : "failed_permanent",
  });

  if (attemptsExceeded && env.SENTRY_DSN_WORKER) {
    Sentry.captureMessage(`marketing_event_attempts_exceeded:${event.name}`, {
      level: "warning",
      extra: { eventId: event.eventId, attempts: nextAttempts, error: outcome.error },
    });
  }

  if (!shouldRetry && env.SENTRY_DSN_WORKER) {
    Sentry.captureMessage(`marketing_event_failed_permanent:${event.name}`, {
      level: "error",
      extra: { eventId: event.eventId, error: outcome.error },
    });
  }

  if (shouldRetry) {
    throw new Error(outcome.error);
  }
}

export async function processMarketingEventJob(
  deps: MarketingEventProcessorDeps,
  event: MarketingEvent,
): Promise<void> {
  const {
    marketingEventOutboxWorker,
    env,
    log,
    identityResolver,
    sgtmPublisher,
    enqueueCapiBatch,
  } = deps;

  if (!isMarketingEventsEnabled(env)) return;

  // Prevent duplicate delivery: the outbox poller may also pick up this row
  // if the BullMQ job takes >60s (e.g. slow Meta, retry storm). Claim the row
  // first; if claiming fails the row is already being processed by the poller
  // or has reached a terminal state — skip to avoid double-publishing.
  const claimed = await marketingEventOutboxWorker.claimSingle(event.eventId);
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
      await applyMarketingPublishOutcome({
        marketingEventOutboxWorker,
        env,
        log,
        event,
        outcome: sgtmOutcome,
      });
      return;
    }
  }

  await enqueueCapiBatch(resolved);
}

export async function runMarketingEventOutboxPoller(input: {
  marketingEventOutboxWorker: IMarketingEventOutboxWorker;
  log: Logger;
  enqueue: (event: MarketingEvent) => Promise<void>;
}): Promise<number> {
  const events = await input.marketingEventOutboxWorker.claimStuckBatch(100);
  for (const event of events) {
    await input.enqueue(event);
  }
  if (events.length > 0) {
    input.log.info({ count: events.length }, "marketing outbox poller re-enqueued");
  }
  return events.length;
}
