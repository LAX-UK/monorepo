import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { deliveryQuote, domainEvent, legalEntity, lot, user } from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleAdminDeliveriesReader } from "./drizzle-admin-deliveries.reader.js";
import {
  DELIVERY_QUOTE_DECLINED_EVENT,
  DrizzleDeliveryQuoteRepository,
} from "./drizzle-delivery-quote.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const REASON = "We don't ship to this region.";

async function inRollback(run: (tx: Database) => Promise<void>) {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const rollback = new Error("rollback_delivery_quote_test");
  try {
    await db.transaction(async (tx) => {
      await run(tx as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

/** A buyer, a staff member, a won lot and a quote for it in `status`. */
async function seed(tx: Database, status: "requested" | "quoted" | "accepted" = "quoted") {
  const now = new Date();
  const tag = randomUUID().slice(0, 8);
  const buyerId = `dq-buyer-${tag}`;
  const staffId = `dq-staff-${tag}`;
  const entityId = randomUUID();
  const lotId = randomUUID();
  await tx.insert(user).values(
    [buyerId, staffId].map((id) => ({
      id,
      name: id,
      email: `${id}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await tx.insert(legalEntity).values({
    id: entityId,
    displayName: `Example Trading ${tag} Ltd`,
    kind: "organisation" as const,
    subkind: "gallery" as const,
    createdByUserId: buyerId,
    status: "approved" as const,
    createdAt: now,
    updatedAt: now,
  });
  await tx.insert(lot).values({
    id: lotId,
    sellerLegalEntityId: entityId,
    title: `Harbour study ${tag}`,
    auctionType: "english" as const,
    startingPrice: "100.00",
    currentPrice: "1250.00",
    minBidIncrement: "10.00",
    startTime: new Date(now.getTime() - 48 * 3_600_000),
    endTime: new Date(now.getTime() - 24 * 3_600_000),
    status: "ended" as const,
    winnerId: buyerId,
    buyerLegalEntityId: entityId,
    createdAt: now,
    updatedAt: now,
  });
  const priced = status !== "requested";
  const [row] = await tx
    .insert(deliveryQuote)
    .values({
      lotId,
      buyerLegalEntityId: entityId,
      status,
      destination: "12 Rue Exemple, 69002 Lyon, France",
      amount: priced ? "180.00" : null,
      requestedByUserId: buyerId,
      ...(priced ? { quotedAt: now, quotedByUserId: staffId } : {}),
    })
    .returning({ id: deliveryQuote.id });
  return { quoteId: row?.id as string, lotId, entityId, staffId, userIds: [buyerId, staffId] };
}

const declinedEvents = (tx: Database, quoteId: string) =>
  tx
    .select()
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.eventType, DELIVERY_QUOTE_DECLINED_EVENT),
        eq(domainEvent.aggregateId, quoteId),
      ),
    );

describe.skipIf(!HAS_DB)("delivery quote repository: decline (integration)", () => {
  it("ends the quote withdrawn with the reason, and audits who declined it in the same write", async () => {
    await inRollback(async (tx) => {
      const { quoteId, lotId, entityId, staffId } = await seed(tx, "quoted");
      const declined = await new DrizzleDeliveryQuoteRepository(tx).decline(quoteId, "quoted", {
        status: "withdrawn",
        actorUserId: staffId,
        reason: REASON,
      });
      expect(declined).toMatchObject({
        id: quoteId,
        status: "withdrawn",
        declineReason: REASON,
        decidedByUserId: staffId,
        amount: "180.00",
      });
      expect(declined?.decidedAt).toBeInstanceOf(Date);

      const events = await declinedEvents(tx, quoteId);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        aggregateType: "delivery_quote",
        actorUserId: staffId,
        producer: "apps/api",
        payload: { quoteId, lotId, legalEntityId: entityId, fromStatus: "quoted" },
      });
      // The reason and the address stay on the quote, never in the audit log.
      expect(JSON.stringify(events[0]?.payload)).not.toContain("ship");
      expect(JSON.stringify(events[0]?.payload)).not.toContain("Lyon");

      // The staff list reads it back: closed as withdrawn, with the reason.
      const record = await new DrizzleAdminDeliveriesReader(tx).findByLotId(lotId);
      expect(record).toMatchObject({
        status: "closed",
        closedReason: "withdrawn",
        quote: { status: "withdrawn", declineReason: REASON },
      });
    });
  });

  it("changes nothing and audits nothing when the quote moved on", async () => {
    await inRollback(async (tx) => {
      const { quoteId, staffId } = await seed(tx, "accepted");
      const repo = new DrizzleDeliveryQuoteRepository(tx);
      expect(
        await repo.decline(quoteId, "quoted", {
          status: "withdrawn",
          actorUserId: staffId,
          reason: REASON,
        }),
      ).toBeNull();
      const [row] = await tx.select().from(deliveryQuote).where(eq(deliveryQuote.id, quoteId));
      expect(row).toMatchObject({ status: "accepted", declineReason: null });
      expect(await declinedEvents(tx, quoteId)).toHaveLength(0);
    });
  });

  it("keeps the quote open when the audit row cannot be written", async () => {
    // Committed for real (not in a rolled-back wrapper), so a write outside the decline's own
    // transaction would stay behind; cleaned up afterwards.
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const { quoteId, lotId, entityId, staffId, userIds } = await seed(db, "requested");
    const trigger = `refuse_decline_audit_${quoteId.replaceAll("-", "")}`;
    try {
      await db.execute(
        sql.raw(`
        create function ${trigger}() returns trigger language plpgsql as $$
        begin raise exception 'audit refused'; end $$`),
      );
      await db.execute(
        sql.raw(`
        create trigger ${trigger} before insert on domain_events for each row
        when (new.aggregate_id = '${quoteId}') execute function ${trigger}()`),
      );
      await expect(
        new DrizzleDeliveryQuoteRepository(db).decline(quoteId, "requested", {
          status: "withdrawn",
          actorUserId: staffId,
          reason: REASON,
        }),
      ).rejects.toThrow();
      const [row] = await db.select().from(deliveryQuote).where(eq(deliveryQuote.id, quoteId));
      expect(row).toMatchObject({ status: "requested", declineReason: null, decidedAt: null });
    } finally {
      await db.execute(sql.raw(`drop trigger if exists ${trigger} on domain_events`));
      await db.execute(sql.raw(`drop function if exists ${trigger}()`));
      await db.delete(lot).where(eq(lot.id, lotId));
      await db.delete(legalEntity).where(eq(legalEntity.id, entityId));
      await db.delete(user).where(inArray(user.id, userIds));
    }
  });

  it("leaves no audit row when the decline fails after the audit insert", async () => {
    // The reverse of the test above: the audit row is written, then the transaction fails at
    // commit (a deferred constraint trigger on the quote). An audit written outside the decline's
    // transaction would commit on its own and claim a decline that never happened. Committed for
    // real, then cleaned up.
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const { quoteId, lotId, entityId, staffId, userIds } = await seed(db, "requested");
    const trigger = `fail_decline_commit_${quoteId.replaceAll("-", "")}`;
    try {
      await db.execute(
        sql.raw(`
        create function ${trigger}() returns trigger language plpgsql as $$
        begin raise exception 'commit refused'; end $$`),
      );
      await db.execute(
        sql.raw(`
        create constraint trigger ${trigger} after update on delivery_quote
        deferrable initially deferred for each row
        when (new.id = '${quoteId}') execute function ${trigger}()`),
      );
      await expect(
        new DrizzleDeliveryQuoteRepository(db).decline(quoteId, "requested", {
          status: "withdrawn",
          actorUserId: staffId,
          reason: REASON,
        }),
      ).rejects.toThrow();
      const [row] = await db.select().from(deliveryQuote).where(eq(deliveryQuote.id, quoteId));
      expect(row).toMatchObject({ status: "requested", declineReason: null, decidedAt: null });
      expect(await declinedEvents(db, quoteId)).toHaveLength(0);
    } finally {
      await db.execute(sql.raw(`drop trigger if exists ${trigger} on delivery_quote`));
      await db.execute(sql.raw(`drop function if exists ${trigger}()`));
      await db.delete(domainEvent).where(eq(domainEvent.aggregateId, quoteId));
      await db.delete(lot).where(eq(lot.id, lotId));
      await db.delete(legalEntity).where(eq(legalEntity.id, entityId));
      await db.delete(user).where(inArray(user.id, userIds));
    }
  });
});
