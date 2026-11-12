import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import {
  bid,
  bidIdentityDirectory,
  buyerDefault,
  legalEntity,
  lot,
  lotReoffer,
  sellerConsent,
  user,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleAdminWorkItemsReader } from "./drizzle-admin-work-items.reader.js";
import { DrizzleLotReofferRepository } from "./drizzle-lot-reoffer.repository.js";
import { DrizzleLotTransitionRepository } from "./drizzle-lot-transition.repository.js";
import { DrizzleReofferStaffReader } from "./drizzle-reoffer-staff.reader.js";
import { DrizzleReofferViewsReader } from "./drizzle-reoffer-views.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const NOW = new Date("2026-11-12T12:00:00.000Z");
const terms = {
  amountPence: 90_000,
  originalHammerPence: 100_000,
  proceedsAtOfferPence: 72_000,
  proceedsAtOriginalPence: 80_000,
  reservePence: null,
};

describe.skipIf(!HAS_DB)("staff reads of a re-offer (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const staff = new DrizzleReofferStaffReader();
  const views = new DrizzleReofferViewsReader(db);
  const work = new DrizzleAdminWorkItemsReader(db);
  const offers = new DrizzleLotReofferRepository();
  const transitions = new DrizzleLotTransitionRepository();

  const staffId = `rs-staff-${randomUUID()}`;
  const buyerId = `rs-buyer-${randomUUID()}`;
  const rivalId = `rs-rival-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const rivalEntity = randomUUID();
  const sellerEntity = randomUUID();
  const lotIds: string[] = [];

  async function defaultedLot(lotStatus: "ended" | "draft" = "ended") {
    const lotId = randomUUID();
    lotIds.push(lotId);
    await db.insert(lot).values({
      id: lotId,
      title: `Staff read ${lotId.slice(0, 4)}`,
      lotNumber: 2,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "1000.00",
      minBidIncrement: "10.00",
      startTime: new Date("2026-10-01T10:00:00Z"),
      endTime: new Date("2026-10-10T10:00:00Z"),
      status: lotStatus,
      sellerLegalEntityId: sellerEntity,
      reservePrice: "950.00",
    });
    const [, second] = await db
      .insert(bid)
      .values([
        { lotId, bidderId: buyerId, buyerLegalEntityId: buyerEntity, amount: "1000.00" },
        { lotId, bidderId: rivalId, buyerLegalEntityId: rivalEntity, amount: "900.00" },
      ])
      .returning({ id: bid.id });
    const [def] = await db
      .insert(buyerDefault)
      .values({
        lotId,
        buyerId,
        buyerLegalEntityId: buyerEntity,
        sellerLegalEntityId: sellerEntity,
        hammerPrice: "1000.00",
        wonAt: new Date("2026-10-10T10:00:00Z"),
        reason: "No payment after reminders",
        outcome: "offered_to_underbidder",
        buyerRestricted: true,
        actorUserId: staffId,
      })
      .returning({ id: buyerDefault.id });
    return { lotId, defaultId: def?.id as string, secondBidId: second?.id as string };
  }

  async function offer(
    s: Awaited<ReturnType<typeof defaultedLot>>,
    status: string,
    over: { dueAt?: Date; respondedAt?: Date; sequence?: number } = {},
  ) {
    const created = await db.transaction((tx) =>
      offers.create(tx, {
        lotId: s.lotId,
        buyerDefaultId: s.defaultId,
        sequence: over.sequence ?? 1,
        offeredUserId: rivalId,
        offeredLegalEntityId: rivalEntity,
        sourceBidId: s.secondBidId,
        amountPence: 90_000,
        status: "awaiting_seller",
        sellerLegalEntityId: sellerEntity,
        consent: {
          status: "requested",
          channel: null,
          terms,
          requestedAt: new Date("2026-11-10T10:00:00Z"),
          dueAt: over.dueAt ?? new Date("2026-11-13T17:00:00Z"),
        },
        createdBy: staffId,
      }),
    );
    await db
      .update(lotReoffer)
      .set({ status, respondedAt: over.respondedAt ?? null, updatedAt: NOW })
      .where(inArray(lotReoffer.id, [created.id]));
    return created;
  }

  /** Gives each lot to the offer's bidder, as a re-award does. */
  const reawardTo = async (...scenarios: { lotId: string }[]) => {
    await db
      .update(lot)
      .set({ winnerId: rivalId, buyerLegalEntityId: rivalEntity })
      .where(
        inArray(
          lot.id,
          scenarios.map((scenario) => scenario.lotId),
        ),
      );
  };

  /** The re-offer work for just these lots, so one test's lots never show in another's. */
  const workFor = async (...scenarios: { lotId: string }[]) => {
    const ids = scenarios.map((scenario) => scenario.lotId);
    return (await work.listReofferWork(1000, NOW)).filter((row) =>
      ids.includes(row.href.split("/").pop() ?? ""),
    );
  };

  beforeAll(async () => {
    for (const [id, name] of [
      [staffId, "Eleanor Pereira"],
      [buyerId, "Buyer"],
      [rivalId, "Rival"],
    ] as const) {
      await db.insert(user).values({
        id,
        name,
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
          name,
          identityCreatedAt: new Date(),
        })
        .onConflictDoNothing();
    }
    for (const [id, name, kind, subkind] of [
      [buyerEntity, "Defaulting Ltd", "individual", "private_collector"],
      [rivalEntity, "Northbank Gallery", "individual", "private_collector"],
      [sellerEntity, "Cedar & Stone", "organisation", "gallery"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: name,
        kind,
        subkind,
        createdByUserId: staffId,
        status: "approved",
      });
    }
  });

  afterAll(async () => {
    await db.delete(lotReoffer).where(inArray(lotReoffer.lotId, lotIds));
    await db.delete(sellerConsent).where(inArray(sellerConsent.lotId, lotIds));
    await db.delete(buyerDefault).where(inArray(buyerDefault.lotId, lotIds));
    await db.delete(bid).where(inArray(bid.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db
      .delete(legalEntity)
      .where(inArray(legalEntity.id, [buyerEntity, rivalEntity, sellerEntity]));
    await db
      .delete(bidIdentityDirectory)
      .where(inArray(bidIdentityDirectory.subjectId, [staffId, buyerId, rivalId]));
    await db.delete(user).where(inArray(user.id, [staffId, buyerId, rivalId]));
    await closeDb(db);
  });

  it("reads the lot without locking it, and keeps a reserve of zero as no reserve", async () => {
    const s = await defaultedLot();
    expect(await staff.lotFacts(db, s.lotId)).toMatchObject({
      status: "ended",
      winnerId: null,
      reservePence: 95_000,
      deleted: false,
    });
    expect(await staff.lotFacts(db, randomUUID())).toBeNull();
  });

  it("reads the default with who recorded it, the buyer and the original sale", async () => {
    const s = await defaultedLot();
    expect(await staff.latestDefaultView(db, s.lotId)).toMatchObject({
      id: s.defaultId,
      recordedByName: "Eleanor Pereira",
      reason: "No payment after reminders",
      originalHammerPence: 100_000,
      buyerRestricted: true,
      buyerUserId: buyerId,
      buyerAccountName: "Defaulting Ltd",
      voidedInvoiceNumber: null,
    });
    expect(await staff.latestDefaultView(db, randomUUID())).toBeNull();
  });

  it("names accounts for staff, and nothing for an empty list", async () => {
    const names = await staff.accountNames(db, [rivalEntity, buyerEntity]);
    expect(names.get(rivalEntity)).toBe("Northbank Gallery");
    expect((await staff.accountNames(db, [])).size).toBe(0);
  });

  it("gives staff the bidder by name, the bid's date and who started the offer", async () => {
    const s = await defaultedLot();
    await offer(s, "awaiting_seller");
    const [row] = await views.listForLot(s.lotId);
    expect(row?.offeredAccountName).toBe("Northbank Gallery");
    expect(row?.createdByName).toBe("Eleanor Pereira");
    expect(row?.closedByName).toBeNull();
    expect(row?.sourceBidPlacedAt).toBeInstanceOf(Date);
    expect(row?.consent).toMatchObject({
      status: "requested",
      remindedAt: null,
      answeredByName: null,
    });
  });

  describe("the work an offer leaves staff", () => {
    it("lists a seller who has not answered only on the last day", async () => {
      const early = await defaultedLot();
      await offer(early, "awaiting_seller", { dueAt: new Date("2026-11-20T17:00:00Z") });
      const lastDay = await defaultedLot();
      await offer(lastDay, "awaiting_seller", { dueAt: new Date("2026-11-12T17:00:00Z") });
      const rows = await workFor(early, lastDay);
      expect(rows.map((row) => row.kind)).toEqual(["reoffer_no_reply"]);
      expect(rows[0]?.title).toBe(
        `Re-offer: no reply from the seller — Lot 2: Staff read ${lastDay.lotId.slice(0, 4)}`,
      );
      expect(rows[0]?.domain).toBe("saleroom");
    });

    it("lists a lapsed request, a ready offer and a declined or ended offer for a lot without a buyer", async () => {
      const lapsed = await defaultedLot();
      await offer(lapsed, "seller_lapsed");
      const ready = await defaultedLot();
      await offer(ready, "ready");
      const ended = await defaultedLot();
      await offer(ended, "expired");
      const declined = await defaultedLot();
      await offer(declined, "declined");
      const kinds = (await workFor(lapsed, ready, ended, declined)).map((row) => row.kind).sort();
      expect(kinds).toEqual([
        "reoffer_decision",
        "reoffer_decision",
        "reoffer_no_reply",
        "reoffer_ready",
      ]);
    });

    /** Every status an offer can leave work in, besides an accepted one. */
    const WORK_STATUSES = [
      "awaiting_seller",
      "ready",
      "seller_lapsed",
      "seller_declined",
      "declined",
      "expired",
    ] as const;
    const onLastDay = { dueAt: new Date("2026-11-12T17:00:00Z") };

    it("leaves out a withdrawn offer", async () => {
      const withdrawn = await defaultedLot();
      await offer(withdrawn, "withdrawn");
      expect(await workFor(withdrawn)).toEqual([]);
    });

    it.each(WORK_STATUSES)(
      "clears a %s item once the lot is returned to inventory",
      async (status) => {
        const s = await defaultedLot();
        await offer(s, status, onLastDay);
        expect(await workFor(s)).toHaveLength(1);
        // The real return: a draft with no sale, number, winner or buyer account.
        await db.transaction((tx) => transitions.resetLotForInventoryReturn(tx, s.lotId, "ended"));
        const [row] = await db.select().from(lot).where(eq(lot.id, s.lotId));
        expect(row).toMatchObject({
          status: "draft",
          winnerId: null,
          saleId: null,
          lotNumber: null,
        });
        expect(await workFor(s)).toEqual([]);
      },
    );

    it.each(WORK_STATUSES)("clears a %s item once the lot is relisted", async (status) => {
      const s = await defaultedLot();
      await offer(s, status, onLastDay);
      expect(await workFor(s)).toHaveLength(1);
      await db.update(lot).set({ status: "scheduled" }).where(eq(lot.id, s.lotId));
      expect(await workFor(s)).toEqual([]);
    });

    it.each(WORK_STATUSES)("clears a %s item once the lot has a buyer again", async (status) => {
      const s = await defaultedLot();
      await offer(s, status, onLastDay);
      expect(await workFor(s)).toHaveLength(1);
      await db
        .update(lot)
        .set({ winnerId: buyerId, buyerLegalEntityId: buyerEntity })
        .where(eq(lot.id, s.lotId));
      expect(await workFor(s)).toEqual([]);
    });

    it.each(WORK_STATUSES)("clears a %s item once the lot is deleted", async (status) => {
      const s = await defaultedLot();
      await offer(s, status, onLastDay);
      expect(await workFor(s)).toHaveLength(1);
      await db.update(lot).set({ deletedAt: new Date() }).where(eq(lot.id, s.lotId));
      expect(await workFor(s)).toEqual([]);
    });

    it.each(["seller_lapsed", "seller_declined", "declined", "expired"] as const)(
      "clears a %s item once a newer offer is made on the lot",
      async (status) => {
        const s = await defaultedLot();
        await offer(s, status);
        expect(await workFor(s)).toHaveLength(1);
        await offer(s, "withdrawn", { sequence: 2 });
        expect(await workFor(s)).toEqual([]);
      },
    );

    it("lists an accepted offer for a week, then lets it clear itself", async () => {
      const recent = await defaultedLot();
      await offer(recent, "accepted", { respondedAt: new Date("2026-11-10T09:00:00Z") });
      const old = await defaultedLot();
      await offer(old, "accepted", { respondedAt: new Date("2026-11-01T09:00:00Z") });
      await reawardTo(recent, old);
      const rows = await workFor(recent, old);
      expect(rows.map((row) => row.kind)).toEqual(["reoffer_accepted"]);
      expect(rows[0]?.href).toBe(`/admin/lots/${recent.lotId}`);
    });

    it("clears an accepted offer once its award no longer stands", async () => {
      const defaulted = await defaultedLot();
      await offer(defaulted, "accepted", { respondedAt: new Date("2026-11-10T09:00:00Z") });
      const returned = await defaultedLot();
      await offer(returned, "accepted", { respondedAt: new Date("2026-11-10T09:00:00Z") });
      await reawardTo(defaulted, returned);
      expect(await workFor(defaulted, returned)).toHaveLength(2);
      // The re-awarded bidder defaults in turn: the lot has no winner again.
      await db
        .update(lot)
        .set({ winnerId: null, buyerLegalEntityId: null })
        .where(eq(lot.id, defaulted.lotId));
      await db.transaction((tx) =>
        transitions.resetLotForInventoryReturn(tx, returned.lotId, "ended"),
      );
      expect(await workFor(defaulted, returned)).toEqual([]);
    });
  });
});
