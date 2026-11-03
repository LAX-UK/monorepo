import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bid,
  bidIdentityDirectory,
  buyerDefault,
  legalEntity,
  lot,
  lotFulfilment,
  payment,
  paymentReminder,
  user,
} from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BuyerDefaultConflictError } from "../interfaces/buyer-default.js";
import { DrizzleAdminWorkItemsReader } from "./drizzle-admin-work-items.reader.js";
import {
  DrizzleBuyerDefaultReader,
  DrizzleBuyerDefaultRepository,
} from "./drizzle-buyer-default.repository.js";
import { DrizzleLotTransitionRepository } from "./drizzle-lot-transition.repository.js";
import { DrizzlePaymentReminderStore } from "./drizzle-payment-reminder.store.js";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";
import { DrizzleAccountPurchaseFactsReader } from "./drizzle-workspace-buying.readers.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("buyer default (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleBuyerDefaultReader(db);
  const repository = new DrizzleBuyerDefaultRepository(db);
  const reminders = new DrizzlePaymentReminderStore(db);
  const workItems = new DrizzleAdminWorkItemsReader(db);
  const purchases = new DrizzleAccountPurchaseFactsReader(db);
  const payouts = new DrizzlePayoutRepository(db);

  const day = 86_400_000;
  const nowMs = Date.now();
  const buyerId = `bd-buyer-${randomUUID()}`;
  const rivalId = `bd-rival-${randomUUID()}`;
  const staffId = `bd-staff-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const rivalEntity = randomUUID();
  const sellerEntity = randomUUID();
  const lots = {
    defaulted: randomUUID(),
    overdue: randomUUID(),
    notYetOverdue: randomUUID(),
    held: randomUUID(),
    paid: randomUUID(),
    cancelledSale: randomUUID(),
  };

  const wonLot = (id: string) => ({
    id,
    title: `Default ${id.slice(0, 4)}`,
    images: [],
    auctionType: "english" as const,
    startingPrice: "100.00",
    currentPrice: "1000.00",
    minBidIncrement: "10.00",
    startTime: new Date(nowMs - 20 * day),
    endTime: new Date(nowMs - 12 * day),
    status: "ended" as const,
    sellerLegalEntityId: sellerEntity,
    winnerId: buyerId,
    buyerLegalEntityId: buyerEntity,
  });

  const invoice = (
    lotId: string,
    status: "pending" | "captured" | "requires_manual_review" | "cancelled",
    raisedDaysAgo: number,
  ) => ({
    lotId,
    buyerId,
    buyerLegalEntityId: buyerEntity,
    sellerLegalEntityId: sellerEntity,
    amount: "1200.00",
    platformFee: "100.00",
    status,
    createdAt: new Date(nowMs - raisedDaysAgo * day),
  });

  const defaultInput = (paymentId: string | null, lotId = lots.defaulted) => ({
    lotId,
    buyerId,
    buyerLegalEntityId: buyerEntity,
    sellerLegalEntityId: sellerEntity,
    paymentId,
    hammerPrice: "1000.00",
    wonAt: new Date(nowMs - 12 * day),
    reason: "No payment after two reminders",
    outcome: "returned_to_inventory" as const,
    offeredUserId: null,
    offeredAmount: null,
    buyerRestricted: false,
    actorUserId: staffId,
  });

  beforeAll(async () => {
    for (const id of [buyerId, rivalId, staffId]) {
      await db.insert(user).values({
        id,
        name: id,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db
        .insert(bidIdentityDirectory)
        .values({
          subjectId: id,
          email: `${id}@integration.test`,
          name: id,
          identityCreatedAt: new Date(),
        })
        .onConflictDoNothing();
    }
    for (const [id, kind, subkind] of [
      [buyerEntity, "individual", "private_collector"],
      [rivalEntity, "individual", "private_collector"],
      [sellerEntity, "organisation", "gallery"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: `Entity ${id.slice(0, 4)}`,
        kind,
        subkind,
        createdByUserId: staffId,
        status: "approved",
      });
    }
    await db.insert(lot).values(Object.values(lots).map(wonLot));
    await db.insert(bid).values([
      {
        lotId: lots.defaulted,
        bidderId: buyerId,
        buyerLegalEntityId: buyerEntity,
        amount: "1000.00",
        isWinning: true,
      },
      {
        lotId: lots.defaulted,
        bidderId: rivalId,
        buyerLegalEntityId: rivalEntity,
        amount: "900.00",
      },
    ]);
    await db
      .insert(payment)
      .values([
        invoice(lots.defaulted, "pending", 8),
        invoice(lots.overdue, "pending", 9),
        invoice(lots.notYetOverdue, "pending", 7),
        invoice(lots.held, "requires_manual_review", 9),
        invoice(lots.paid, "captured", 9),
        invoice(lots.cancelledSale, "cancelled", 9),
      ]);
    await db.insert(lotFulfilment).values([
      { lotId: lots.defaulted, status: "awaiting_payment" },
      { lotId: lots.cancelledSale, status: "cancelled" },
    ]);
  });

  afterAll(async () => {
    const lotIds = Object.values(lots);
    await db.delete(buyerDefault).where(inArray(buyerDefault.lotId, lotIds));
    await db.delete(lotFulfilment).where(inArray(lotFulfilment.lotId, lotIds));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bid).where(inArray(bid.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db
      .delete(legalEntity)
      .where(inArray(legalEntity.id, [buyerEntity, rivalEntity, sellerEntity]));
    await db
      .delete(bidIdentityDirectory)
      .where(inArray(bidIdentityDirectory.subjectId, [buyerId, rivalId, staffId]));
    await db.delete(user).where(inArray(user.id, [buyerId, rivalId, staffId]));
  });

  const paymentOf = async (lotId: string) =>
    (await db.select().from(payment).where(eq(payment.lotId, lotId)))[0];

  describe("overdue payments in the work inbox", () => {
    it("lists an unpaid won lot from the day after its due date, and no sooner", async () => {
      const rows = await workItems.listOverduePayments(100, new Date());
      const ids = rows.map((r) => r.sourceId);
      expect(ids).toContain(lots.overdue);
      expect(ids).not.toContain(lots.notYetOverdue);
    });

    it("leaves out payments held for our own checks, paid lots and cancelled sales", async () => {
      const ids = (await workItems.listOverduePayments(100, new Date())).map((r) => r.sourceId);
      expect(ids).not.toContain(lots.held);
      expect(ids).not.toContain(lots.paid);
      expect(ids).not.toContain(lots.cancelledSale);
    });

    it("links to the lot and says who owes what", async () => {
      const row = (await workItems.listOverduePayments(100, new Date())).find(
        (r) => r.sourceId === lots.overdue,
      );
      expect(row?.kind).toBe("payment_overdue");
      expect(row?.href).toBe(`/admin/lots/${lots.overdue}`);
      expect(row?.subtitle).toContain("£1,200.00");
    });
  });

  describe("payment reminders", () => {
    it("lists unpaid invoices and takes each step once", async () => {
      const candidates = await reminders.listCandidates(500);
      const ids = candidates.map((c) => c.lotId);
      expect(ids).toContain(lots.overdue);
      expect(ids).not.toContain(lots.paid);
      expect(ids).not.toContain(lots.cancelledSale);

      const overdue = candidates.find((c) => c.lotId === lots.overdue);
      const paymentId = overdue?.paymentId ?? "";
      expect(await reminders.claim(paymentId, "before_due")).toBe(true);
      expect(await reminders.claim(paymentId, "before_due")).toBe(false);
      const again = (await reminders.listCandidates(500)).find((c) => c.paymentId === paymentId);
      expect(again?.sentSteps).toEqual(["before_due"]);

      await reminders.release(paymentId, "before_due");
      expect(await reminders.claim(paymentId, "before_due")).toBe(true);
      await db.delete(paymentReminder).where(eq(paymentReminder.paymentId, paymentId));
    });
  });

  describe("recording a buyer default", () => {
    it("reads the lot, its invoice and the other bidders", async () => {
      const facts = await reader.readFacts(lots.defaulted);
      expect(facts?.lot.status).toBe("ended");
      expect(facts?.payment?.status).toBe("pending");
      expect(facts?.fulfilmentStatus).toBe("awaiting_payment");
      expect(facts?.bids.map((b) => b.legalEntityId).sort()).toEqual(
        [buyerEntity, rivalEntity].sort(),
      );
    });

    it("voids the invoice without deleting it, cancels the sale and takes the winner off the lot", async () => {
      const original = await paymentOf(lots.defaulted);
      await db.transaction(async (tx) => {
        await repository.record(tx as never, defaultInput(original?.id ?? null));
        await new DrizzleLotTransitionRepository().resetLotForInventoryReturn(
          tx as never,
          lots.defaulted,
          "ended",
        );
      });

      const voided = await paymentOf(lots.defaulted);
      expect(voided?.id).toBe(original?.id);
      expect(voided?.status).toBe("cancelled");

      const [fulfilment] = await db
        .select()
        .from(lotFulfilment)
        .where(eq(lotFulfilment.lotId, lots.defaulted));
      expect(fulfilment?.status).toBe("cancelled");

      const [after] = await db.select().from(lot).where(eq(lot.id, lots.defaulted));
      expect(after?.status).toBe("draft");
      expect(after?.winnerId).toBeNull();
      expect(after?.buyerLegalEntityId).toBeNull();

      const bids = await db.select().from(bid).where(eq(bid.lotId, lots.defaulted));
      expect(bids).toHaveLength(2);
      expect(bids.every((b) => !b.isWinning)).toBe(true);

      const [record] = await db
        .select()
        .from(buyerDefault)
        .where(eq(buyerDefault.lotId, lots.defaulted));
      expect(record).toMatchObject({
        paymentId: original?.id,
        reason: "No payment after two reminders",
        outcome: "returned_to_inventory",
        actorUserId: staffId,
      });
    });

    it("creates no seller payout for a voided sale", async () => {
      const unlinked = await payouts.findUnlinkedCapturedPayments(sellerEntity);
      const voided = await paymentOf(lots.defaulted);
      expect(unlinked.map((p) => p.id)).not.toContain(voided?.id);
      // The paid lot, by contrast, is waiting to be paid out.
      const paid = await paymentOf(lots.paid);
      expect(unlinked.map((p) => p.id)).toContain(paid?.id);
    });

    it("keeps the purchase on the buyer's list as a cancelled sale, never as owed", async () => {
      const rows = await purchases.list({
        legalEntityId: buyerEntity,
        memberUserId: null,
        limit: 50,
        offset: 0,
      });
      const row = rows.find((r) => r.lotId === lots.defaulted);
      expect(row?.fulfilment?.status).toBe("cancelled");
      expect(row?.hammerPrice).toBe("1000.00");
      expect(row?.payment?.status).toBe("cancelled");
      // A lot that is still won appears once; the defaulted one adds exactly one row.
      expect(rows.filter((r) => r.lotId === lots.defaulted)).toHaveLength(1);
    });

    it("says the invoice was voided, so it is never reinstated", async () => {
      const voided = await paymentOf(lots.defaulted);
      expect(await repository.isVoided(voided?.id ?? "")).toBe(true);
      const other = await paymentOf(lots.overdue);
      expect(await repository.isVoided(other?.id ?? "")).toBe(false);
    });

    it("refuses to void a payment that has been paid in the meantime", async () => {
      const paid = await paymentOf(lots.paid);
      await expect(
        db.transaction((tx) =>
          repository.record(tx as never, defaultInput(paid?.id ?? null, lots.paid)),
        ),
      ).rejects.toBeInstanceOf(BuyerDefaultConflictError);
      expect((await paymentOf(lots.paid))?.status).toBe("captured");
    });

    it("refuses when the lot is no longer won by that buyer", async () => {
      await expect(
        db.transaction((tx) => repository.record(tx as never, defaultInput(null, lots.defaulted))),
      ).rejects.toBeInstanceOf(BuyerDefaultConflictError);
    });

    it("records one default per invoice", async () => {
      const original = await paymentOf(lots.defaulted);
      const rows = await db
        .select()
        .from(buyerDefault)
        .where(and(eq(buyerDefault.paymentId, original?.id ?? "")));
      expect(rows).toHaveLength(1);
    });
  });
});
