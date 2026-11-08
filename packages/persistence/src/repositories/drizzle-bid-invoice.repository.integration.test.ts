import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { bidInvoice, bidUserProfile, legalEntity, lot, payment, user } from "@auction/db/schema";
import { holdStartAt, payHeldSinceAfter } from "@auction/domain";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { bidInvoiceKey } from "../interfaces/bid-invoice.repository.js";
import { DrizzleAdminWorkItemsReader } from "./drizzle-admin-work-items.reader.js";
import { DrizzleBidInvoiceRepository } from "./drizzle-bid-invoice.repository.js";
import { DrizzleKycRepository } from "./drizzle-kyc.repository.js";
import { DrizzleLegalEntityLifecycleAdminRepository } from "./drizzle-legal-entity-lifecycle-admin.repository.js";
import { DrizzlePaymentRepository } from "./drizzle-payment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const DAY_MS = 86_400_000;

/**
 * A buyer with two won lots, each with a payment and a stored invoice. Runs in a transaction that
 * is rolled back, so it leaves no rows behind.
 */
async function seedTwoInvoices(tx: Database, tag: string, now: Date) {
  const buyerId = `invoice-due-buyer-${tag}`;
  const sellerEntityId = randomUUID();
  const buyerEntityId = randomUUID();
  await tx.insert(user).values({
    id: buyerId,
    name: buyerId,
    email: `${buyerId}@integration.test`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await tx.insert(bidUserProfile).values({ userId: buyerId, createdAt: now, updatedAt: now });
  await tx.insert(legalEntity).values(
    [sellerEntityId, buyerEntityId].map((id) => ({
      id,
      displayName: id,
      kind: "organisation" as const,
      subkind: "gallery" as const,
      createdByUserId: buyerId,
      status: "approved" as const,
      createdAt: now,
      updatedAt: now,
    })),
  );
  const lotIds = [randomUUID(), randomUUID()];
  await tx.insert(lot).values(
    lotIds.map((id, index) => ({
      id,
      sellerLegalEntityId: sellerEntityId,
      title: `Invoice due lot ${index} ${tag}`,
      images: [],
      auctionType: "english" as const,
      startingPrice: "100.00",
      currentPrice: "250.00",
      minBidIncrement: "10.00",
      startTime: new Date(now.getTime() - 20 * DAY_MS),
      endTime: new Date(now.getTime() - 15 * DAY_MS),
      status: "ended" as const,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntityId,
      createdAt: now,
      updatedAt: now,
    })),
  );
  return { buyerId, sellerEntityId, buyerEntityId, lotIds };
}

async function addInvoice(
  tx: Database,
  input: {
    lotId: string;
    buyerId: string;
    buyerEntityId: string;
    sellerEntityId: string;
    paymentCreatedAt: Date;
    dueAt: Date;
  },
) {
  const [invoice] = await tx
    .insert(bidInvoice)
    .values({
      lotId: input.lotId,
      buyerLegalEntityId: input.buyerEntityId,
      sellerLegalEntityId: input.sellerEntityId,
      totalPence: 31_250,
      raisedAt: input.paymentCreatedAt,
      dueAt: input.dueAt,
    })
    .returning();
  const [row] = await tx
    .insert(payment)
    .values({
      lotId: input.lotId,
      buyerId: input.buyerId,
      buyerLegalEntityId: input.buyerEntityId,
      sellerLegalEntityId: input.sellerEntityId,
      amount: "312.50",
      platformFee: "0.00",
      status: "pending",
      invoiceId: invoice?.id,
      createdAt: input.paymentCreatedAt,
    })
    .returning();
  return { invoiceId: invoice?.id as string, paymentId: row?.id as string };
}

describe.skipIf(!HAS_DB)("stored invoice due dates (integration)", () => {
  it("the staff overdue list reads the stored due date, not the payment's age", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const base = await seedTwoInvoices(tx as unknown as Database, tag, now);
        const common = {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
        };
        // Raised just now, but its stored due date has passed: overdue.
        await addInvoice(tx as unknown as Database, {
          ...common,
          lotId: base.lotIds[0] as string,
          paymentCreatedAt: now,
          dueAt: new Date(now.getTime() - 2 * DAY_MS),
        });
        // Its payment row is ten days old, but its stored due date is still ahead: not overdue.
        await addInvoice(tx as unknown as Database, {
          ...common,
          lotId: base.lotIds[1] as string,
          paymentCreatedAt: new Date(now.getTime() - 10 * DAY_MS),
          dueAt: new Date(now.getTime() + 3 * DAY_MS),
        });

        const reader = new DrizzleAdminWorkItemsReader(tx as unknown as Database);
        const overdue = await reader.listOverduePayments(500, now);
        const lotIds = overdue.map((item) => item.sourceId);
        expect(lotIds).toContain(base.lotIds[0]);
        expect(lotIds).not.toContain(base.lotIds[1]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("the staff overdue list puts the longest overdue first, by stored due date", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const base = await seedTwoInvoices(tx as unknown as Database, tag, now);
        const common = {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
        };
        // Raised first, but its term was moved on and it fell due later.
        await addInvoice(tx as unknown as Database, {
          ...common,
          lotId: base.lotIds[0] as string,
          paymentCreatedAt: new Date(now.getTime() - 20 * DAY_MS),
          dueAt: new Date(now.getTime() - 1 * DAY_MS),
        });
        // Raised later, but fell due earlier: the longer overdue of the two.
        await addInvoice(tx as unknown as Database, {
          ...common,
          lotId: base.lotIds[1] as string,
          paymentCreatedAt: new Date(now.getTime() - 10 * DAY_MS),
          dueAt: new Date(now.getTime() - 5 * DAY_MS),
        });

        const reader = new DrizzleAdminWorkItemsReader(tx as unknown as Database);
        const lotIds = (await reader.listOverduePayments(500, now)).map((item) => item.sourceId);
        expect(lotIds.indexOf(base.lotIds[1] as string)).toBeGreaterThanOrEqual(0);
        expect(lotIds.indexOf(base.lotIds[1] as string)).toBeLessThan(
          lotIds.indexOf(base.lotIds[0] as string),
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("the staff overdue list does not drop a payment that has no stored invoice", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const database = tx as unknown as Database;
        const base = await seedTwoInvoices(database, tag, now);
        const bare = (lotId: string, daysAgo: number) =>
          database.insert(payment).values({
            lotId,
            buyerId: base.buyerId,
            buyerLegalEntityId: base.buyerEntityId,
            sellerLegalEntityId: base.sellerEntityId,
            amount: "312.50",
            platformFee: "0.00",
            status: "pending",
            createdAt: new Date(now.getTime() - daysAgo * DAY_MS),
          });
        // Raised ten days ago with no invoice: its term has ended. Raised two days ago: it has not.
        await bare(base.lotIds[0] as string, 10);
        await bare(base.lotIds[1] as string, 2);

        const overdue = await new DrizzleAdminWorkItemsReader(database).listOverduePayments(
          500,
          now,
        );
        const lotIds = overdue.map((item) => item.sourceId);
        expect(lotIds).toContain(base.lotIds[0]);
        expect(lotIds).not.toContain(base.lotIds[1]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("extending a due date moves it later and never earlier", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const database = tx as unknown as Database;
        const base = await seedTwoInvoices(database, tag, now);
        const dueAt = new Date(now.getTime() + 2 * DAY_MS);
        const { invoiceId, paymentId } = await addInvoice(database, {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
          lotId: base.lotIds[0] as string,
          paymentCreatedAt: now,
          dueAt,
        });
        const repo = new DrizzleBidInvoiceRepository(database);
        const dueOf = async () =>
          (await database.select().from(bidInvoice).where(eq(bidInvoice.id, invoiceId)))[0]?.dueAt;

        // An earlier date changes nothing.
        expect(await repo.extendDueAt(invoiceId, new Date(dueAt.getTime() - DAY_MS))).toBe(false);
        expect(await repo.extendDueAt(invoiceId, dueAt)).toBe(false);
        expect(await dueOf()).toEqual(dueAt);

        // A later date moves it.
        const later = new Date(dueAt.getTime() + 5 * DAY_MS);
        expect(await repo.extendDueAt(invoiceId, later)).toBe(true);
        expect(await dueOf()).toEqual(later);

        // The expiry job reads it through the payment.
        const found = await new DrizzlePaymentRepository(database).findById(paymentId);
        expect(found?.invoiceDueAt).toEqual(later);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("a hold release reaches only the unpaid live invoices in scope, in one statement", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const database = tx as unknown as Database;
        const base = await seedTwoInvoices(database, tag, now);
        const common = {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
          paymentCreatedAt: now,
        };
        const soon = new Date(now.getTime() + 2 * DAY_MS);
        const open = await addInvoice(database, {
          ...common,
          lotId: base.lotIds[0] as string,
          dueAt: soon,
        });
        const paid = await addInvoice(database, {
          ...common,
          lotId: base.lotIds[1] as string,
          dueAt: soon,
        });
        await database
          .update(payment)
          .set({ status: "captured" })
          .where(eq(payment.id, paid.paymentId));
        const repo = new DrizzleBidInvoiceRepository(database);
        const holdStartedAt = new Date(now.getTime() - DAY_MS);
        const account = {
          kind: "account",
          legalEntityId: base.buyerEntityId,
          holdStartedAt,
        } as const;
        const dueOf = async (invoiceId: string) =>
          (await database.select().from(bidInvoice).where(eq(bidInvoice.id, invoiceId)))[0]?.dueAt;
        let step = 0;
        const until = () => new Date(now.getTime() + (10 + ++step) * DAY_MS);

        // Only the unpaid invoice moves; a paid one keeps its date.
        const first = until();
        expect(await repo.extendUnpaidDueDates(account, first, database)).toBe(1);
        expect(await dueOf(open.invoiceId)).toEqual(first);
        expect(await dueOf(paid.invoiceId)).toEqual(soon);

        // A payment held for review is not released by this.
        await database
          .update(payment)
          .set({ status: "requires_manual_review" })
          .where(eq(payment.id, open.paymentId));
        expect(await repo.extendUnpaidDueDates(account, until(), database)).toBe(0);
        await database
          .update(payment)
          .set({ status: "pending" })
          .where(eq(payment.id, open.paymentId));

        // A voided invoice never moves.
        await database
          .update(bidInvoice)
          .set({ voidedAt: now })
          .where(eq(bidInvoice.id, open.invoiceId));
        expect(await repo.extendUnpaidDueDates(account, until(), database)).toBe(0);
        await database
          .update(bidInvoice)
          .set({ voidedAt: null })
          .where(eq(bidInvoice.id, open.invoiceId));

        // By winner: an organisation's invoice counts, unless only personal accounts are asked for.
        const anyAccount = {
          kind: "winner",
          userId: base.buyerId,
          personalAccountsOnly: false,
          holdStartedAt,
        } as const;
        const personal = { ...anyAccount, personalAccountsOnly: true };
        expect(await repo.extendUnpaidDueDates(personal, until(), database)).toBe(0);
        expect(await repo.extendUnpaidDueDates(anyAccount, until(), database)).toBe(1);
        await database
          .update(legalEntity)
          .set({ kind: "individual", subkind: "private_collector" })
          .where(eq(legalEntity.id, base.buyerEntityId));
        expect(await repo.extendUnpaidDueDates(personal, until(), database)).toBe(1);
        expect(
          await repo.extendUnpaidDueDates(
            { kind: "account", legalEntityId: randomUUID(), holdStartedAt },
            until(),
            database,
          ),
        ).toBe(0);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("a hold release leaves debt that was overdue before the hold, moves later only and is idempotent", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const database = tx as unknown as Database;
        const base = await seedTwoInvoices(database, tag, now);
        const common = {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
          paymentCreatedAt: now,
        };
        const overdueBefore = new Date(now.getTime() - 3 * DAY_MS);
        const dueDuring = new Date(now.getTime() + DAY_MS);
        const early = await addInvoice(database, {
          ...common,
          lotId: base.lotIds[0] as string,
          dueAt: overdueBefore,
        });
        const during = await addInvoice(database, {
          ...common,
          lotId: base.lotIds[1] as string,
          dueAt: dueDuring,
        });
        const repo = new DrizzleBidInvoiceRepository(database);
        const scope = {
          kind: "account",
          legalEntityId: base.buyerEntityId,
          // The hold began a day ago: one invoice was already overdue before that.
          holdStartedAt: new Date(now.getTime() - DAY_MS),
        } as const;
        const dueOf = async (invoiceId: string) =>
          (await database.select().from(bidInvoice).where(eq(bidInvoice.id, invoiceId)))[0]?.dueAt;

        const releasedUntil = new Date(now.getTime() + 8 * DAY_MS);
        expect(await repo.extendUnpaidDueDates(scope, releasedUntil, database)).toBe(1);
        expect(await dueOf(early.invoiceId)).toEqual(overdueBefore);
        expect(await dueOf(during.invoiceId)).toEqual(releasedUntil);

        // Releasing again changes nothing, and an earlier release never pulls a date back.
        expect(await repo.extendUnpaidDueDates(scope, releasedUntil, database)).toBe(0);
        expect(
          await repo.extendUnpaidDueDates(scope, new Date(now.getTime() + DAY_MS), database),
        ).toBe(0);
        expect(await dueOf(during.invoiceId)).toEqual(releasedUntil);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("reads the live invoices of many lots in one go, only for the pairs asked", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const database = tx as unknown as Database;
        const base = await seedTwoInvoices(database, tag, now);
        const common = {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
          paymentCreatedAt: now,
          dueAt: new Date(now.getTime() + 2 * DAY_MS),
        };
        const first = await addInvoice(database, { ...common, lotId: base.lotIds[0] as string });
        await addInvoice(database, { ...common, lotId: base.lotIds[1] as string });
        const repo = new DrizzleBidInvoiceRepository(database);

        const found = await repo.findLiveByLotsAndBuyerAccounts([
          { lotId: base.lotIds[0] as string, buyerLegalEntityId: base.buyerEntityId },
          // Another account's claim on the second lot finds nothing.
          { lotId: base.lotIds[1] as string, buyerLegalEntityId: randomUUID() },
        ]);
        expect([...found.keys()]).toEqual([
          bidInvoiceKey(base.lotIds[0] as string, base.buyerEntityId),
        ]);
        expect(found.get(bidInvoiceKey(base.lotIds[0] as string, base.buyerEntityId))?.id).toBe(
          first.invoiceId,
        );
        expect(await repo.findLiveByLotsAndBuyerAccounts([])).toEqual(new Map());
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("an organisation's hold starts when it stops being able to pay and survives the review steps", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const at = (days: number) => new Date(now.getTime() + days * DAY_MS);

    try {
      await db.transaction(async (tx) => {
        const database = tx as unknown as Database;
        const base = await seedTwoInvoices(database, tag, now);
        const common = {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
          paymentCreatedAt: now,
        };
        // Overdue before the organisation was held, and falling due while it was.
        const early = await addInvoice(database, {
          ...common,
          lotId: base.lotIds[0] as string,
          dueAt: at(-5),
        });
        const during = await addInvoice(database, {
          ...common,
          lotId: base.lotIds[1] as string,
          dueAt: at(1),
        });
        const lifecycle = new DrizzleLegalEntityLifecycleAdminRepository(database);
        const repo = new DrizzleBidInvoiceRepository(database);

        // approved -> documents asked for -> received -> under review, a day apart.
        const path = ["approved", "docs_requested", "docs_received", "under_review"] as const;
        const stepTo = async (i: number, to: "approved" | (typeof path)[number], from: string) => {
          const row = await lifecycle.findByIdForUpdate(database, base.buyerEntityId);
          await lifecycle.applyTransitionUpdate(database, {
            entityId: base.buyerEntityId,
            actorUserId: base.buyerId,
            nextStatus: to,
            statusReason: null,
            clientMessage: null,
            payHeldSince: payHeldSinceAfter({
              from: from as (typeof path)[number],
              to,
              heldSince: row?.payHeldSince ?? null,
              at: at(-2 + i),
            }),
          });
        };
        for (let i = 1; i < path.length; i += 1) {
          await stepTo(i, path[i] as (typeof path)[number], path[i - 1] as string);
        }
        // Held since the first step, not since the last: each step kept the start.
        const held = await lifecycle.findByIdForUpdate(database, base.buyerEntityId);
        expect(held?.status).toBe("under_review");
        expect(held?.payHeldSince).toEqual(at(-1));

        // Released: only the invoice that fell due during the hold moves.
        const until = at(8);
        const moved = await repo.extendUnpaidDueDates(
          {
            kind: "account",
            legalEntityId: base.buyerEntityId,
            holdStartedAt: holdStartAt(held?.payHeldSince),
          },
          until,
          database,
        );
        expect(moved).toBe(1);
        const dueOf = async (id: string) =>
          (await database.select().from(bidInvoice).where(eq(bidInvoice.id, id)))[0]?.dueAt;
        expect(await dueOf(early.invoiceId)).toEqual(at(-5));
        expect(await dueOf(during.invoiceId)).toEqual(until);

        // And the release itself clears the record.
        await stepTo(4, "approved", "under_review");
        expect(
          (await lifecycle.findByIdForUpdate(database, base.buyerEntityId))?.payHeldSince,
        ).toBeNull();
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("an identity's hold starts when approval is lost; a verified period's debt is not reset", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);

    try {
      await db.transaction(async (tx) => {
        const database = tx as unknown as Database;
        const base = await seedTwoInvoices(database, tag, now);
        const kyc = new DrizzleKycRepository(database);
        const repo = new DrizzleBidInvoiceRepository(database);
        const heldSinceOf = async () =>
          (await kyc.getUserKycState(base.buyerId, database))?.identityHeldSince;

        // Never approved: nothing recorded, so a release reaches every invoice.
        await kyc.setUserKycStatus(base.buyerId, "pending", null, database);
        expect(await heldSinceOf()).toBeNull();
        await kyc.setUserKycStatus(base.buyerId, "approved", now, database);
        expect(await heldSinceOf()).toBeNull();

        // Approval lost, then a step between held statuses: the loss is what is recorded.
        await kyc.setUserKycStatus(base.buyerId, "rejected", null, database);
        const lostAt = await heldSinceOf();
        expect(lostAt).toBeInstanceOf(Date);
        await kyc.setUserKycStatus(base.buyerId, "pending", null, database);
        expect(await heldSinceOf()).toEqual(lostAt);

        // One invoice fell due during the verified period (before the loss), one after it.
        const common = {
          buyerId: base.buyerId,
          buyerEntityId: base.buyerEntityId,
          sellerEntityId: base.sellerEntityId,
          paymentCreatedAt: now,
        };
        const verifiedPeriod = await addInvoice(database, {
          ...common,
          lotId: base.lotIds[0] as string,
          dueAt: new Date((lostAt as Date).getTime() - 2 * DAY_MS),
        });
        const heldPeriod = await addInvoice(database, {
          ...common,
          lotId: base.lotIds[1] as string,
          dueAt: new Date((lostAt as Date).getTime() + 2 * DAY_MS),
        });

        const until = new Date((lostAt as Date).getTime() + 9 * DAY_MS);
        const moved = await repo.extendUnpaidDueDates(
          {
            kind: "winner",
            userId: base.buyerId,
            personalAccountsOnly: false,
            holdStartedAt: holdStartAt(await heldSinceOf()),
          },
          until,
          database,
        );
        expect(moved).toBe(1);
        const dueOf = async (id: string) =>
          (await database.select().from(bidInvoice).where(eq(bidInvoice.id, id)))[0]?.dueAt;
        expect(await dueOf(heldPeriod.invoiceId)).toEqual(until);
        expect((await dueOf(verifiedPeriod.invoiceId))?.getTime()).toBeLessThan(
          (lostAt as Date).getTime(),
        );

        // Approved again: the hold is cleared.
        await kyc.setUserKycStatus(base.buyerId, "approved", now, database);
        expect(await heldSinceOf()).toBeNull();
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
