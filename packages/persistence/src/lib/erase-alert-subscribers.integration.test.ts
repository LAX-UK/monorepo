import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidAlertSubscriber, bidAlertTopic, visitorSaleAlertSubscriber } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { holdAlertTablesLock } from "../testing/alert-tables-lock.js";
import { eraseAlertSubscribers } from "./erase-alert-subscribers.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const now = new Date();
const consent = { consentText: "Email me", consentSource: "test", requestedAt: now };

holdAlertTablesLock({ beforeAll, afterAll }, "shared");

describe.skipIf(!HAS_DB)("alert subscriber erasure (integration)", () => {
  it("erases by normalised email, keeps complaint suppressions, and is idempotent", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const email = `erase-${tag}@example.com`;
    const other = `other-${tag}@example.com`;
    const complained = `complained-${tag}@example.com`;

    try {
      await db.transaction(async (tx) => {
        const [mine] = await tx
          .insert(bidAlertSubscriber)
          .values({ product: "bid", email, status: "confirmed", ...consent })
          .returning();
        await tx
          .insert(bidAlertTopic)
          .values({ subscriberId: mine?.id as string, topic: "bid.artists", emailOn: true });
        await tx
          .insert(bidAlertSubscriber)
          .values({ product: "bid", email: other, status: "confirmed", ...consent });
        await tx.insert(bidAlertSubscriber).values({
          product: "bid",
          email: complained,
          status: "stopped",
          stopReason: "complaint",
          ...consent,
        });
        await tx
          .insert(visitorSaleAlertSubscriber)
          .values({ email, status: "confirmed", ...consent });
        await tx
          .insert(visitorSaleAlertSubscriber)
          .values({ email: other, status: "confirmed", ...consent });

        const first = await eraseAlertSubscribers(tx as never, {
          emails: [`  ${email.toUpperCase()} `, complained],
        });
        expect(first).toEqual({ alertSubscribers: 1, visitorSaleAlerts: 1, suppressionsKept: 1 });

        const left = await tx
          .select({ email: bidAlertSubscriber.email })
          .from(bidAlertSubscriber)
          .where(eq(bidAlertSubscriber.product, "bid"));
        const addresses = left.map((row) => row.email);
        expect(addresses).toEqual(expect.arrayContaining([other, complained]));
        expect(addresses).not.toContain(email);
        const topics = await tx
          .select()
          .from(bidAlertTopic)
          .where(eq(bidAlertTopic.subscriberId, mine?.id as string));
        expect(topics).toHaveLength(0);
        const visitors = await tx
          .select({ email: visitorSaleAlertSubscriber.email })
          .from(visitorSaleAlertSubscriber)
          .where(eq(visitorSaleAlertSubscriber.email, other));
        expect(visitors).toHaveLength(1);

        const second = await eraseAlertSubscribers(tx as never, { emails: [email, complained] });
        expect(second).toEqual({ alertSubscribers: 0, visitorSaleAlerts: 0, suppressionsKept: 1 });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("erases an account's own rows and the visitor row for the same address", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const email = `acct-${tag}@example.com`;
    const userId = `user_${tag}`;

    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`insert into "user" (id, email, name, created_at, updated_at) values (${userId}, ${email}, 'Probe', now(), now())`,
        );
        await tx.insert(bidAlertSubscriber).values({
          product: "bid",
          email,
          subjectId: userId,
          status: "confirmed",
          ...consent,
        });
        await tx
          .insert(visitorSaleAlertSubscriber)
          .values({ email, status: "confirmed", ...consent });

        const counts = await eraseAlertSubscribers(tx as never, { emails: [], userIds: [userId] });
        expect(counts).toEqual({ alertSubscribers: 1, visitorSaleAlerts: 1, suppressionsKept: 0 });
        expect(await eraseAlertSubscribers(tx as never, { emails: [], userIds: [userId] })).toEqual(
          { alertSubscribers: 0, visitorSaleAlerts: 0, suppressionsKept: 0 },
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
