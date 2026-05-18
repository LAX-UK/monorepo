import type { ICircuitBreaker, MetaCapiMarketingEventPublisher } from "@auction/marketing-events";
import type { PublishOutcome, ResolvedMarketingEvent } from "@auction/types";
import { Counter, Histogram } from "prom-client";

export const marketingEventsCapiBatchSize = new Histogram({
  name: "marketing_events_capi_batch_size",
  help: "Number of events per Meta CAPI batch request",
  buckets: [1, 2, 5, 10, 25, 50, 100],
});

export const marketingEventsCapiBufferDropped = new Counter({
  name: "marketing_events_capi_buffer_dropped_total",
  help: "Events dropped because the CAPI batch buffer exceeded its capacity limit",
});

const CAPI_BREAKER_KEY = "meta_capi";

export type CapiBatchOutcomeHandler = (
  event: ResolvedMarketingEvent,
  outcome: PublishOutcome,
) => Promise<void>;

export class MetaCapiBatchCollector {
  private buffer: ResolvedMarketingEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> = Promise.resolve();

  constructor(
    private readonly metaPublisher: MetaCapiMarketingEventPublisher,
    private readonly onOutcome: CapiBatchOutcomeHandler,
    private readonly maxBatch = 100,
    private readonly flushMs = 1000,
    private readonly maxBuffer = 1000,
    private readonly breaker: ICircuitBreaker | null = null,
  ) {}

  async add(event: ResolvedMarketingEvent): Promise<void> {
    if (this.buffer.length >= this.maxBuffer) {
      marketingEventsCapiBufferDropped.inc();
      await this.onOutcome(event, {
        status: "failed",
        error: "capi_buffer_full",
        retryable: true,
      });
      return;
    }

    this.buffer.push(event);
    if (this.buffer.length >= this.maxBatch) {
      await this.scheduleFlush();
      return;
    }
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        void this.scheduleFlush();
      }, this.flushMs);
    }
  }

  private scheduleFlush(): Promise<void> {
    this.flushing = this.flushing.then(() => this.flush());
    return this.flushing;
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const batch = this.buffer.splice(0, this.maxBatch);
    if (batch.length === 0) return;

    marketingEventsCapiBatchSize.observe(batch.length);

    let outcomes: PublishOutcome[];
    try {
      if (this.breaker) {
        outcomes = await this.breaker.run(CAPI_BREAKER_KEY, () =>
          this.metaPublisher.publishBatch(batch),
        );
      } else {
        outcomes = await this.metaPublisher.publishBatch(batch);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const failOutcome: PublishOutcome = { status: "failed", error, retryable: true };
      outcomes = batch.map(() => failOutcome);
    }

    if (this.breaker) {
      const hasRetryableFailure = outcomes.some(
        (o) => o.status === "failed" && o.retryable,
      );
      if (hasRetryableFailure) {
        this.breaker.recordFailure(CAPI_BREAKER_KEY);
      }
    }

    for (let i = 0; i < batch.length; i++) {
      await this.onOutcome(batch[i]!, outcomes[i]!);
    }

    if (this.buffer.length > 0) {
      await this.flush();
    }
  }
}
