import type { WebPublicCacheInvalidator } from "@auction/background-runtime";

/** What the projector needs besides the shared cursor and event reader. */
export type WebPublicCacheDeps = {
  invalidator: WebPublicCacheInvalidator;
  /** The lot's current sale, for lot events whose payload names none (a cancellation). */
  lotSaleId(lotId: string): Promise<string | null>;
  /** The newest domain event id: a first run starts here instead of replaying history. */
  latestEventId(): Promise<number>;
};
