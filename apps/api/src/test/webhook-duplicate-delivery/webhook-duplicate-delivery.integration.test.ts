import { createDb } from "@auction/db";
import { processedStripeEvents, processedWebhookEvents } from "@auction/db/schema";
import { PostmarkEmailService } from "@auction/email";
import {
  DrizzleNotificationWriteRepository,
  DrizzleUserRepository,
} from "@auction/persistence/repositories";
import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { KycNoticeQueue } from "../../services/kyc/kyc-notice-queue.js";
import { NotificationFactory } from "../../services/notification.factory.js";
import { claimGatedRunner } from "../claim-gated-runner.js";
import { claimIsBlockedOnLock } from "../claim-lock-wait.js";
import { transactionRunnerFromDb } from "../transaction-runner-from-db.js";
import { connectCases } from "./connect.cases.js";
import { identityCases } from "./identity.cases.js";
import { settlementCases } from "./settlement.cases.js";
import { stripePaymentCases } from "./stripe-payment.cases.js";
import type { DeliveryCase } from "./support.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const CASES: DeliveryCase[] = [
  ...stripePaymentCases,
  ...connectCases,
  ...identityCases,
  ...settlementCases,
];

// Every event id contains this, so a run can clean up after itself.
const RUN = `dup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!HAS_DB)("the same webhook delivered twice at once (integration)", () => {
  // The handlers run as the role in DATABASE_URL (api_app in CI's role job); the owner connection
  // only looks at the claims, watches for the lock wait and cleans up.
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const handlerUrl = process.env.DATABASE_URL!;
  const handlerDb = createDb(handlerUrl);
  const db = createDb(process.env.DATABASE_URL_OWNER ?? handlerUrl);
  const base = transactionRunnerFromDb(handlerDb);
  // What people are told is stored by the handler's own role, in the delivery's transaction.
  const notices = new KycNoticeQueue({
    usersFor: (tx) => new DrizzleUserRepository(tx ?? handlerDb),
    notificationsFor: (tx) => new DrizzleNotificationWriteRepository(tx ?? handlerDb),
    email: new PostmarkEmailService(handlerDb, { add: async () => undefined }),
    factory: new NotificationFactory(),
    webOrigin: "https://lax.bid",
  });
  const eventIdFor = (handler: DeliveryCase, scenario: string) =>
    `${RUN}_${handler.name.replace(/\W+/g, "_")}_${scenario}`;

  const claimRows = (handler: DeliveryCase, eventId: string) => {
    const table =
      handler.claimsTable === "processed_stripe_events"
        ? processedStripeEvents
        : processedWebhookEvents;
    return db
      .select()
      .from(table)
      .where(eq(table.eventId, handler.claimedEventId(eventId)));
  };

  /** The rows a case stores besides its claim are there once, and are then cleaned up. */
  async function expectStoredOnce(handler: DeliveryCase, eventId: string) {
    const { fixture } = handler;
    if (!fixture) return;
    try {
      expect(await fixture.stored(db, eventId)).toEqual(fixture.expected);
    } finally {
      await fixture.clean(db, eventId);
    }
  }

  afterAll(async () => {
    await db.delete(processedStripeEvents).where(like(processedStripeEvents.eventId, `%${RUN}%`));
    await db.delete(processedWebhookEvents).where(like(processedWebhookEvents.eventId, `%${RUN}%`));
  });

  describe.each(CASES)("$name", (handler) => {
    it("makes the second delivery wait on the first's claim, and stores the effect itself when the first fails", async () => {
      const eventId = eventIdFor(handler, "fails");
      await handler.fixture?.seed(db, eventId);
      const gate = claimGatedRunner(base, "fail");
      const { deliver, effect } = handler.build(eventId, gate.runner, notices);

      const first = deliver().then(
        () => null,
        (error: unknown) => error,
      );
      await gate.claimed;
      const second = deliver();

      // The first has claimed the event but not committed: the second must be waiting on that
      // claim, and must not answer "duplicate" for work that is not stored.
      expect(await claimIsBlockedOnLock(db, handler.claimsTable)).toBe(true);
      expect(effect).not.toHaveBeenCalled();
      gate.release();
      expect(await first).toEqual(new Error("injected failure after the claim"));

      await second;
      expect(effect).toHaveBeenCalledTimes(1);
      expect(await claimRows(handler, eventId)).toHaveLength(1);
      await expectStoredOnce(handler, eventId);
    });

    it("answers the second delivery as a duplicate only once the first has committed", async () => {
      const eventId = eventIdFor(handler, "commits");
      await handler.fixture?.seed(db, eventId);
      const gate = claimGatedRunner(base, "pass");
      const { deliver, effect, isDuplicate } = handler.build(eventId, gate.runner, notices);

      const first = deliver();
      await gate.claimed;
      const second = deliver();
      expect(await claimIsBlockedOnLock(db, handler.claimsTable)).toBe(true);
      gate.release();

      const firstResult = await first;
      const secondResult = await second;
      if (isDuplicate) {
        expect(isDuplicate(firstResult)).toBe(false);
        expect(isDuplicate(secondResult)).toBe(true);
      }
      expect(effect).toHaveBeenCalledTimes(1);
      expect(await claimRows(handler, eventId)).toHaveLength(1);
      await expectStoredOnce(handler, eventId);
    });
  });
});
