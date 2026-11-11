import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import {
  bid,
  bidIdentityDirectory,
  buyerDefault,
  legalEntity,
  lot,
  lotFulfilment,
  lotReoffer,
  payment,
  sellerConsent,
  user,
} from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LotReawardRefusedError,
  LotReofferConflictError,
  type SellerConsentTerms,
} from "../interfaces/lot-reoffer.js";
import { DrizzleLotReawardRepository } from "./drizzle-lot-reaward.repository.js";
import {
  DrizzleLotReofferReader,
  DrizzleLotReofferRepository,
  DrizzleSellerConsentRepository,
} from "./drizzle-lot-reoffer.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
/** Postgres' insufficient_privilege. */
const DENIED = "42501";
const WORKER_URL = process.env.DATABASE_URL_WORKER ?? process.env.WORKER_APP_DATABASE_URL;

const terms: SellerConsentTerms = {
  amountPence: 90_000,
  originalHammerPence: 100_000,
  proceedsAtOfferPence: 72_000,
  proceedsAtOriginalPence: 80_000,
  reservePence: null,
};

describe.skipIf(!HAS_DB)("lot re-offer persistence (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleLotReofferReader(db);
  const offers = new DrizzleLotReofferRepository();
  const consents = new DrizzleSellerConsentRepository(db);
  const reaward = new DrizzleLotReawardRepository();

  const staffId = `ro-staff-${randomUUID()}`;
  const buyerId = `ro-buyer-${randomUUID()}`;
  const rivalId = `ro-rival-${randomUUID()}`;
  const thirdId = `ro-third-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const rivalEntity = randomUUID();
  const thirdEntity = randomUUID();
  const sellerEntity = randomUUID();
  const lotIds: string[] = [];
  const acceptedAt = new Date("2026-11-12T10:00:00.000Z");

  /** A defaulted lot: ended, no buyer, the defaulter's bid and two underbids, one default. */
  async function defaultedLot() {
    const lotId = randomUUID();
    lotIds.push(lotId);
    await db.insert(lot).values({
      id: lotId,
      title: `Re-offer ${lotId.slice(0, 4)}`,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "1000.00",
      minBidIncrement: "10.00",
      startTime: new Date("2026-10-01T10:00:00Z"),
      endTime: new Date("2026-10-10T10:00:00Z"),
      status: "ended",
      sellerLegalEntityId: sellerEntity,
      winnerId: null,
      buyerLegalEntityId: null,
    });
    const [winning, second, third] = await db
      .insert(bid)
      .values([
        { lotId, bidderId: buyerId, buyerLegalEntityId: buyerEntity, amount: "1000.00" },
        { lotId, bidderId: rivalId, buyerLegalEntityId: rivalEntity, amount: "900.00" },
        { lotId, bidderId: thirdId, buyerLegalEntityId: thirdEntity, amount: "800.00" },
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
        reason: "No payment",
        outcome: "offered_to_underbidder",
        actorUserId: staffId,
      })
      .returning({ id: buyerDefault.id });
    await db
      .insert(lotFulfilment)
      .values({ lotId, status: "cancelled", paymentId: null })
      .onConflictDoNothing();
    return {
      lotId,
      defaultId: def?.id as string,
      bids: {
        winning: winning?.id as string,
        second: second?.id as string,
        third: third?.id as string,
      },
    };
  }

  type Scenario = Awaited<ReturnType<typeof defaultedLot>>;

  async function createOffer(
    s: Scenario,
    over: {
      defaultId?: string;
      sequence?: number;
      to?: "second" | "third";
      status?: string;
      respondedAt?: Date | null;
    } = {},
  ) {
    const second = (over.to ?? "second") === "second";
    const created = await db.transaction((tx) =>
      offers.create(tx, {
        lotId: s.lotId,
        buyerDefaultId: over.defaultId ?? s.defaultId,
        sequence: over.sequence ?? 1,
        offeredUserId: second ? rivalId : thirdId,
        offeredLegalEntityId: second ? rivalEntity : thirdEntity,
        sourceBidId: second ? s.bids.second : s.bids.third,
        amountPence: second ? 90_000 : 80_000,
        status: "awaiting_seller",
        sellerLegalEntityId: sellerEntity,
        consent: {
          status: "requested",
          channel: null,
          terms,
          requestedAt: new Date("2026-11-10T10:00:00Z"),
          dueAt: new Date("2026-11-13T17:00:00Z"),
        },
        createdBy: staffId,
      }),
    );
    if (over.status) {
      await db
        .update(lotReoffer)
        .set({
          status: over.status,
          respondedAt: over.respondedAt === undefined ? acceptedAt : over.respondedAt,
          offerSentAt: acceptedAt,
        })
        .where(eq(lotReoffer.id, created.id));
    }
    return created;
  }

  /** The lot's buyer defaults again: the winner is taken off and a later default is recorded. */
  async function defaultAgain(s: Scenario, buyer: { id: string; entity: string }) {
    await db.update(payment).set({ status: "cancelled" }).where(eq(payment.lotId, s.lotId));
    await db
      .update(lot)
      .set({ winnerId: null, buyerLegalEntityId: null })
      .where(eq(lot.id, s.lotId));
    await db.update(bid).set({ isWinning: false }).where(eq(bid.lotId, s.lotId));
    const [def] = await db
      .insert(buyerDefault)
      .values({
        lotId: s.lotId,
        buyerId: buyer.id,
        buyerLegalEntityId: buyer.entity,
        sellerLegalEntityId: sellerEntity,
        hammerPrice: "900.00",
        wonAt: acceptedAt,
        reason: "No payment",
        outcome: "offered_to_underbidder",
        actorUserId: staffId,
        createdAt: new Date(Date.now() + 1000),
      })
      .returning({ id: buyerDefault.id });
    return def?.id as string;
  }

  const runReaward = (reofferId: string) =>
    db.transaction((tx) => reaward.reaward(tx, { reofferId }));
  const refusal = async (reofferId: string) => {
    const error = await runReaward(reofferId).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(LotReawardRefusedError);
    return (error as LotReawardRefusedError).code;
  };
  const lotRow = async (lotId: string) => (await db.select().from(lot).where(eq(lot.id, lotId)))[0];
  const addPayment = (
    lotId: string,
    status: "pending" | "authorized" | "captured" | "requires_manual_review" | "cancelled",
  ) =>
    db.insert(payment).values({
      lotId,
      buyerId: rivalId,
      buyerLegalEntityId: rivalEntity,
      sellerLegalEntityId: sellerEntity,
      amount: "1080.00",
      platformFee: "90.00",
      status,
    });

  beforeAll(async () => {
    for (const id of [staffId, buyerId, rivalId, thirdId]) {
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
      [thirdEntity, "individual", "private_collector"],
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
  });

  afterAll(async () => {
    await db.delete(lotReoffer).where(inArray(lotReoffer.lotId, lotIds));
    await db.delete(sellerConsent).where(inArray(sellerConsent.lotId, lotIds));
    await db.delete(buyerDefault).where(inArray(buyerDefault.lotId, lotIds));
    await db.delete(lotFulfilment).where(inArray(lotFulfilment.lotId, lotIds));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bid).where(inArray(bid.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    const entities = [buyerEntity, rivalEntity, thirdEntity, sellerEntity];
    await db.delete(legalEntity).where(inArray(legalEntity.id, entities));
    const users = [staffId, buyerId, rivalId, thirdId];
    await db.delete(bidIdentityDirectory).where(inArray(bidIdentityDirectory.subjectId, users));
    await db.delete(user).where(inArray(user.id, users));
  });

  describe("offers and seller answers", () => {
    it("creates the offer with its seller request, and reads it back in order", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s);
      const consent = await consents.findForReoffer(first.id);
      expect(consent).toMatchObject({
        id: first.consentId,
        status: "requested",
        subjectType: "lot_reoffer",
        subjectId: first.id,
        termsSnapshot: terms,
      });
      expect(await reader.findOpenForLot(s.lotId)).toMatchObject({
        id: first.id,
        status: "awaiting_seller",
        sequence: 1,
        amountPence: 90_000,
      });
      expect((await reader.listForDefault(s.defaultId)).map((o) => o.sequence)).toEqual([1]);
    });

    it("refuses a second open offer for the lot", async () => {
      const s = await defaultedLot();
      await createOffer(s);
      await expect(createOffer(s, { sequence: 2, to: "third" })).rejects.toBeInstanceOf(
        LotReofferConflictError,
      );
    });

    it("refuses a repeated sequence for one default, and a fourth offer", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s);
      await db.update(lotReoffer).set({ status: "declined" }).where(eq(lotReoffer.id, first.id));
      await expect(createOffer(s, { sequence: 1, to: "third" })).rejects.toBeInstanceOf(
        LotReofferConflictError,
      );
      await expect(createOffer(s, { sequence: 4, to: "third" })).rejects.toThrow();
    });

    it("moves an offer only from the status the caller read", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s);
      await db.transaction((tx) =>
        offers.changeStatus(tx, { id: first.id, from: "awaiting_seller", to: "ready" }),
      );
      await expect(
        db.transaction((tx) =>
          offers.changeStatus(tx, { id: first.id, from: "awaiting_seller", to: "ready" }),
        ),
      ).rejects.toBeInstanceOf(LotReofferConflictError);
      const sentAt = new Date("2026-11-11T09:00:00Z");
      await db.transaction((tx) =>
        offers.changeStatus(tx, {
          id: first.id,
          from: "ready",
          to: "offered",
          offerSentAt: sentAt,
          offerEndsAt: new Date("2026-11-14T17:00:00Z"),
        }),
      );
      await db.transaction(async (tx) =>
        expect(await offers.recordsForDefault(tx, s.defaultId)).toEqual([
          { status: "offered", offerSentAt: sentAt },
        ]),
      );
    });

    it("records a seller answer once, and refuses it again", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s);
      const answer = {
        id: first.consentId,
        from: "requested",
        to: "refused",
        channel: "recorded_by_staff",
        answeredByUserId: staffId,
        answeredAt: acceptedAt,
        note: "Phoned: keep it for a later sale",
        preferredNext: "later_sale",
      } as const;
      await db.transaction((tx) => consents.answer(tx, answer));
      await expect(db.transaction((tx) => consents.answer(tx, answer))).rejects.toBeInstanceOf(
        LotReofferConflictError,
      );
      expect(await consents.findById(first.consentId)).toMatchObject({
        status: "refused",
        channel: "recorded_by_staff",
        preferredNext: "later_sale",
      });
    });

    it("sends the one reminder once", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s);
      expect(await consents.markReminded(first.consentId, acceptedAt)).toBe(true);
      expect(await consents.markReminded(first.consentId, acceptedAt)).toBe(false);
    });
  });

  // The sweeps run as the restricted worker_app role, so what they write is what its column
  // grants must allow: a lapse, a reminder, the status moves a sweep makes, and nothing more.
  describe.skipIf(!WORKER_URL)("sweeps running as worker_app", () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by WORKER_URL
    const workerDb = createDb(WORKER_URL!);
    const workerConsents = new DrizzleSellerConsentRepository(workerDb);

    afterAll(async () => {
      await closeDb(workerDb);
    });

    it("lapses an unanswered seller request and moves the offer to seller_lapsed", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s);
      await workerDb.transaction(async (tx) => {
        await workerConsents.answer(tx, {
          id: first.consentId,
          from: "requested",
          to: "lapsed",
          channel: null,
          answeredByUserId: null,
          answeredAt: acceptedAt,
          note: null,
          preferredNext: null,
        });
        await offers.changeStatus(tx, {
          id: first.id,
          from: "awaiting_seller",
          to: "seller_lapsed",
          closedBy: null,
          closeReason: "The seller did not answer in time",
        });
      });
      expect(await consents.findById(first.consentId)).toMatchObject({
        status: "lapsed",
        channel: null,
        answeredByUserId: null,
        answeredAt: acceptedAt,
      });
      expect((await reader.findById(first.id))?.status).toBe("seller_lapsed");
    });

    it("sends the seller's one reminder", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s);
      expect(await workerConsents.markReminded(first.consentId, acceptedAt)).toBe(true);
    });

    it("ends an offer the bidder let run out", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s, { status: "offered", respondedAt: null });
      await workerDb.transaction((tx) =>
        offers.changeStatus(tx, {
          id: first.id,
          from: "offered",
          to: "expired",
          closedBy: null,
          closeReason: "The offer ran out",
        }),
      );
      expect((await reader.findById(first.id))?.status).toBe("expired");
    });

    it("still cannot make a re-award, re-price an offer or change who it is for", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s);
      await expect(
        workerDb
          .update(lotReoffer)
          .set({ reawardedAt: acceptedAt })
          .where(eq(lotReoffer.id, first.id)),
      ).rejects.toMatchObject({ cause: { code: DENIED } });
      await expect(
        workerDb.update(lotReoffer).set({ amountPence: 1 }).where(eq(lotReoffer.id, first.id)),
      ).rejects.toMatchObject({ cause: { code: DENIED } });
    });
  });

  describe("reaward", () => {
    it("makes the bidder the winner at the offered amount and leaves the original hammer", async () => {
      const s = await defaultedLot();
      const offer = await createOffer(s, { status: "accepted" });

      const result = await runReaward(offer.id);

      expect(result).toMatchObject({
        outcome: "reawarded",
        lotId: s.lotId,
        newBuyerId: rivalId,
        newBuyerLegalEntityId: rivalEntity,
        previousBuyerId: buyerId,
        amountPence: 90_000,
        originalHammerPence: 100_000,
        wonAt: acceptedAt,
      });
      const row = await lotRow(s.lotId);
      expect(row?.winnerId).toBe(rivalId);
      expect(row?.buyerLegalEntityId).toBe(rivalEntity);
      expect(row?.currentPrice).toBe("900.00");
      expect(row?.endTime).toEqual(acceptedAt);
      expect(row?.status).toBe("ended");

      const winning = await db
        .select({ id: bid.id })
        .from(bid)
        .where(and(eq(bid.lotId, s.lotId), eq(bid.isWinning, true)));
      expect(winning.map((b) => b.id)).toEqual([s.bids.second]);

      const [fulfilment] = await db
        .select()
        .from(lotFulfilment)
        .where(eq(lotFulfilment.lotId, s.lotId));
      expect(fulfilment).toMatchObject({ status: "awaiting_payment", paymentId: null });

      const [def] = await db.select().from(buyerDefault).where(eq(buyerDefault.id, s.defaultId));
      expect(def?.hammerPrice).toBe("1000.00");
      expect(def?.buyerId).toBe(buyerId);
    });

    it("resets every buyer-specific fulfilment field for the new buyer", async () => {
      const s = await defaultedLot();
      const offer = await createOffer(s, { status: "accepted" });
      const paid = (await addPayment(s.lotId, "cancelled").returning({ id: payment.id }))[0];
      await db
        .update(lotFulfilment)
        .set({
          status: "ready_for_collection",
          paymentId: paid?.id,
          releaseApprovedByUserId: staffId,
          releaseApprovedAt: acceptedAt,
          fulfilmentMethod: "shipping",
          shippingCarrier: "DHL",
          trackingNumber: "TRK1",
          collectedBy: "Old buyer",
          collectedByUserId: staffId,
          collectedAt: acceptedAt,
          addressSnapshot: { line1: "1 Old Street" },
          paymentClearedAt: acceptedAt,
          notes: "Old buyer asked for courier",
        })
        .where(eq(lotFulfilment.lotId, s.lotId));

      await runReaward(offer.id);

      const [fulfilment] = await db
        .select()
        .from(lotFulfilment)
        .where(eq(lotFulfilment.lotId, s.lotId));
      expect(fulfilment).toMatchObject({
        status: "awaiting_payment",
        paymentId: null,
        releaseApprovedByUserId: null,
        releaseApprovedAt: null,
        fulfilmentMethod: null,
        shippingCarrier: null,
        trackingNumber: null,
        collectedBy: null,
        collectedByUserId: null,
        collectedAt: null,
        addressSnapshot: null,
        paymentClearedAt: null,
        notes: null,
      });
    });

    it("stamps the offer, so a repeat is a no-op even once the buyer's payment is under way", async () => {
      const s = await defaultedLot();
      const offer = await createOffer(s, { status: "accepted" });
      await runReaward(offer.id);
      const [row] = await db.select().from(lotReoffer).where(eq(lotReoffer.id, offer.id));
      expect(row?.reawardedAt).toBeInstanceOf(Date);
      await addPayment(s.lotId, "captured");
      const again = await runReaward(offer.id);
      expect(again.outcome).toBe("already_reawarded");
      expect(again.wonAt).toEqual(row?.reawardedAt);
    });

    it("refuses a retried re-award after the new buyer defaulted too, and writes nothing", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s, { status: "accepted" });
      await runReaward(first.id);
      await defaultAgain(s, { id: rivalId, entity: rivalEntity });

      // The retry must not make the bidder who defaulted the winner again. Not even as a repeat.
      expect(await refusal(first.id)).toBe("offer_superseded");
      const row = await lotRow(s.lotId);
      expect(row?.winnerId).toBeNull();
      expect(row?.buyerLegalEntityId).toBeNull();
      const winning = await db
        .select({ id: bid.id })
        .from(bid)
        .where(and(eq(bid.lotId, s.lotId), eq(bid.isWinning, true)));
      expect(winning).toEqual([]);
    });

    it("lets the second default's offer win the lot ahead of the first offer's retry", async () => {
      const s = await defaultedLot();
      const first = await createOffer(s, { status: "accepted" });
      await runReaward(first.id);
      const secondDefault = await defaultAgain(s, { id: rivalId, entity: rivalEntity });
      const second = await createOffer(s, {
        defaultId: secondDefault,
        sequence: 1,
        to: "third",
        status: "accepted",
      });

      // The retry reaches the lot lock first; it still loses to the later default's offer.
      let release: () => void = () => undefined;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      let holding: () => void = () => undefined;
      const holdingLock = new Promise<void>((resolve) => {
        holding = resolve;
      });
      const holder = db.transaction(async (tx) => {
        await tx.select({ id: lot.id }).from(lot).where(eq(lot.id, s.lotId)).for("update");
        holding();
        await released;
      });
      await holdingLock;
      const retry = refusal(first.id);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const accept = runReaward(second.id);
      await new Promise((resolve) => setTimeout(resolve, 200));
      release();
      await holder;

      expect(await retry).toBe("offer_superseded");
      expect((await accept).outcome).toBe("reawarded");
      const row = await lotRow(s.lotId);
      expect(row?.winnerId).toBe(thirdId);
      expect(row?.currentPrice).toBe("800.00");
      const winning = await db
        .select({ id: bid.id })
        .from(bid)
        .where(and(eq(bid.lotId, s.lotId), eq(bid.isWinning, true)));
      expect(winning.map((b) => b.id)).toEqual([s.bids.third]);
    });

    it("refuses an offer whose source bid is another bidder's", async () => {
      const s = await defaultedLot();
      const offer = await createOffer(s, { status: "accepted" });
      await db
        .update(lotReoffer)
        .set({ sourceBidId: s.bids.third })
        .where(eq(lotReoffer.id, offer.id));
      expect(await refusal(offer.id)).toBe("offer_bid_mismatch");
      expect((await lotRow(s.lotId))?.winnerId).toBeNull();
    });

    it("does nothing the second time", async () => {
      const s = await defaultedLot();
      const offer = await createOffer(s, { status: "accepted" });
      await runReaward(offer.id);
      await addPayment(s.lotId, "pending");
      expect((await runReaward(offer.id)).outcome).toBe("already_reawarded");
    });

    it.each(["captured", "authorized", "requires_manual_review"] as const)(
      "refuses when a payment on the lot is %s, and writes nothing",
      async (status) => {
        const s = await defaultedLot();
        const offer = await createOffer(s, { status: "accepted" });
        await addPayment(s.lotId, "cancelled");
        await addPayment(s.lotId, status);
        expect(await refusal(offer.id)).toBe("payment_in_progress");
        expect((await lotRow(s.lotId))?.winnerId).toBeNull();
        expect((await lotRow(s.lotId))?.currentPrice).toBe("1000.00");
      },
    );

    it("is not stopped by payments that are cancelled or still pending", async () => {
      const s = await defaultedLot();
      const offer = await createOffer(s, { status: "accepted" });
      await addPayment(s.lotId, "cancelled");
      await addPayment(s.lotId, "pending");
      expect((await runReaward(offer.id)).outcome).toBe("reawarded");
    });

    it("refuses when another offer of the default was accepted", async () => {
      const s = await defaultedLot();
      await createOffer(s, { sequence: 1, status: "accepted" });
      const later = await createOffer(s, { sequence: 2, to: "third", status: "accepted" });
      expect(await refusal(later.id)).toBe("already_re_offered");
      expect((await lotRow(s.lotId))?.winnerId).toBeNull();
    });

    it.each(["offered", "declined", "expired", "withdrawn"])(
      "refuses an offer that is %s",
      async (status) => {
        const s = await defaultedLot();
        const offer = await createOffer(s, { status });
        expect(await refusal(offer.id)).toBe("offer_not_accepted");
      },
    );

    it("refuses an accepted offer with no time of acceptance", async () => {
      const s = await defaultedLot();
      const offer = await createOffer(s, { status: "accepted", respondedAt: null });
      expect(await refusal(offer.id)).toBe("offer_not_accepted");
    });

    it("refuses a lot that has a buyer again", async () => {
      const s = await defaultedLot();
      const offer = await createOffer(s, { status: "accepted" });
      await db
        .update(lot)
        .set({ winnerId: thirdId, buyerLegalEntityId: thirdEntity })
        .where(eq(lot.id, s.lotId));
      expect(await refusal(offer.id)).toBe("lot_has_buyer");
    });

    it("refuses an unknown offer", async () => {
      expect(await refusal(randomUUID())).toBe("offer_not_found");
    });

    it("waits for the lot's row lock, then sees a payment taken in the meantime", async () => {
      const s = await defaultedLot();
      const offer = await createOffer(s, { status: "accepted" });
      let release: () => void = () => undefined;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      let holding: () => void = () => undefined;
      const holdingLock = new Promise<void>((resolve) => {
        holding = resolve;
      });

      // One transaction holds the lot and records a captured payment before it lets go.
      const holder = db.transaction(async (tx) => {
        await tx.select({ id: lot.id }).from(lot).where(eq(lot.id, s.lotId)).for("update");
        holding();
        await released;
        await tx.insert(payment).values({
          lotId: s.lotId,
          buyerId: rivalId,
          buyerLegalEntityId: rivalEntity,
          sellerLegalEntityId: sellerEntity,
          amount: "1080.00",
          platformFee: "90.00",
          status: "captured",
        });
      });
      await holdingLock;

      let settled = false;
      const attempt = runReaward(offer.id).then(
        (value) => {
          settled = true;
          return { value, error: null };
        },
        (error: unknown) => {
          settled = true;
          return { value: null, error };
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(settled).toBe(false);

      release();
      await holder;
      const { value, error } = await attempt;
      expect(value).toBeNull();
      expect(error).toBeInstanceOf(LotReawardRefusedError);
      expect((error as LotReawardRefusedError).code).toBe("payment_in_progress");
      expect((await lotRow(s.lotId))?.winnerId).toBeNull();
    });
  });
});
