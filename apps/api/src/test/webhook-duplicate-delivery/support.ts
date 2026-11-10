import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { type Mock, vi } from "vitest";
import type { IDomainEventSink } from "../../services/domain-event-sink.js";
import type { IKycNoticeQueue } from "../../services/kyc/kyc-notice-queue.js";

/**
 * One webhook handler wired for the duplicate-delivery tests. Its transactions run on the given
 * runner (so the claim is real); everything else it depends on is a stand-in, and `effect` is the
 * call that stores what the event is for, so a test can count how many deliveries stored it.
 */
export type DeliveryCase = {
  name: string;
  /** The event id the handler claims. */
  claimedEventId(eventId: string): string;
  /** The claims table the handler writes to. */
  claimsTable: "processed_stripe_events" | "processed_webhook_events";
  /**
   * Rows the handler writes besides the claim, counted after the deliveries. The owner connection
   * seeds the rows it needs (the handler's own role cannot write identity rows), counts what the
   * deliveries stored, and cleans up.
   */
  fixture?: {
    seed(owner: Database, eventId: string): Promise<void>;
    stored(owner: Database, eventId: string): Promise<Record<string, number>>;
    /** What a pair of deliveries must have stored, whichever way they went. */
    expected: Record<string, number>;
    clean(owner: Database, eventId: string): Promise<void>;
  };
  /**
   * `notices` is the real queue of what people are told, on the handler's own stores (the role
   * under test), or null where there is no database and a stand-in is used.
   */
  build(
    eventId: string,
    runner: ITransactionRunner,
    notices: IKycNoticeQueue | null,
  ): {
    deliver(): Promise<unknown>;
    effect: Mock;
    /** Whether a delivery's result says "already handled"; omitted when the result cannot. */
    isDuplicate?: (result: unknown) => boolean;
  };
};

/** A stand-in for a dependency: any method not given answers with nothing. */
export function stub<T extends object>(given: Record<string, unknown> = {}): T {
  const methods = new Map<string | symbol, unknown>(Object.entries(given));
  return new Proxy({} as T, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      if (!methods.has(prop))
        methods.set(
          prop,
          vi.fn(async () => undefined),
        );
      return methods.get(prop);
    },
  });
}

/** An event sink whose transactional `publish` is the given effect. */
export function eventSink(publish: Mock = vi.fn(async () => undefined)) {
  return stub<IDomainEventSink>({ withTx: () => ({ publish }), publish });
}

export function stripeEvent(id: string, type: string, object: unknown, account?: string) {
  return { id, type, data: { object }, ...(account ? { account } : {}) } as Stripe.Event;
}

export function duplicateEventResult(result: unknown): boolean {
  return (result as { reason?: string }).reason === "duplicate_event";
}
