import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import {
  bid,
  bidIdentityDirectory,
  bidUserProfile,
  buyerDefault,
  legalEntity,
  lot,
  lotFulfilment,
  lotReoffer,
  payment,
  sellerConsent,
} from "@auction/db/schema";
import {
  DrizzleLotReawardRepository,
  DrizzleLotReofferRepository,
  DrizzleNeedsYouFactsReader,
  DrizzleReofferViewsReader,
  DrizzleReofferWorkflowReader,
  DrizzleSellerConsentRepository,
  DrizzleTransactionRunner,
} from "@auction/persistence/repositories";
import { LotEventSchemas } from "@auction/types";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import type { LotReofferEventType } from "../interfaces/lot-lifecycle-recorder.js";
import type { ReofferMemberActor, ReofferStaffActor } from "./reoffer-actors.js";
import { ReofferConsentService } from "./reoffer-consent.service.js";
import { ReofferError } from "./reoffer-errors.js";
import { ReofferOfferService } from "./reoffer-offer.service.js";
import type { IReofferMoneyPauseGuard } from "./reoffer-ports.js";
import { ReofferReadsService } from "./reoffer-reads.service.js";
import { ReofferResponseService } from "./reoffer-response.service.js";
import { ReofferStartService } from "./reoffer-start.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** Wednesday 11 November 2026, 10:00 London (GMT). */
const T0 = new Date("2026-11-11T10:00:00.000Z");
const HOUR = 3_600_000;

const sales: ReofferStaffActor = {
  userId: "placeholder",
  role: "staff",
  staffRoles: ["sales_manager"],
};

describe.skipIf(!HAS_DB)("re-offer API services (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);

  const tag = randomUUID().slice(0, 8);
  const staffId = `rs-staff-${tag}`;
  const ids = {
    buyer: `rs-buyer-${tag}`,
    second: `rs-second-${tag}`,
    third: `rs-third-${tag}`,
    fourth: `rs-fourth-${tag}`,
  };
  const entity = {
    buyer: randomUUID(),
    second: randomUUID(),
    third: randomUUID(),
    fourth: randomUUID(),
    seller: randomUUID(),
    otherSeller: randomUUID(),
  };
  const lotIds: string[] = [];
  const staff: ReofferStaffActor = { ...sales, userId: staffId };

  // ---- the services, on the real repositories, with the outside world controllable ----
  const clock = { now: T0 };
  const events: { lotId: string; type: string; payload: unknown; actor: string | null }[] = [];
  const recorder = {
    async recordReoffer(
      _tx: unknown,
      lotRow: { id: string },
      type: LotReofferEventType,
      payload: unknown,
      actor: string | null,
    ) {
      // Every payload must satisfy the catalog: ids and amounts only.
      LotEventSchemas[type].parse(payload);
      events.push({ lotId: lotRow.id, type, payload, actor });
    },
  };
  const control = {
    soldOnAtg: false,
    placeRefusal: null as string | null,
    paused: null as string | null,
    pauseCalls: [] as { step: string; lotId: string }[],
    laxOwned: false,
    invoiced: [] as string[],
    pricedFor: [] as { buyerLegalEntityId: string; hammerPence: number }[],
  };
  const moneyPause: IReofferMoneyPauseGuard = {
    async assertNotPaused(step, context) {
      control.pauseCalls.push({ step, lotId: context.lotId });
      if (control.paused) throw new ReofferError("money_paused", control.paused);
    },
  };
  const workflow = new DrizzleReofferWorkflowReader();
  const offers = new DrizzleLotReofferRepository();
  const consents = new DrizzleSellerConsentRepository(db);
  const base = {
    transactionRunner: new DrizzleTransactionRunner(db),
    workflow,
    offers,
    recorder,
    now: () => clock.now,
  };
  const atg = { soldOnAtg: async () => control.soldOnAtg };
  const place = {
    check: async () =>
      control.placeRefusal
        ? { ok: false as const, message: control.placeRefusal }
        : { ok: true as const },
  };
  const start = new ReofferStartService({
    ...base,
    atg,
    proceeds: {
      // Settlement's shape: a 25% premium on the hammer, and a 5% fee on that total.
      proceedsFor: async ({ buyerLegalEntityId, hammerPence }) => {
        control.pricedFor.push({ buyerLegalEntityId, hammerPence });
        const salePence = Math.round(hammerPence * 1.25);
        return { salePence, proceedsPence: Math.round(salePence * 0.95) };
      },
    },
    ownership: { of: () => (control.laxOwned ? "lax_owned" : "seller") },
  });
  const consent = new ReofferConsentService({ ...base, consents });
  const offer = new ReofferOfferService({ ...base, consents, atg, place, moneyPause });
  const response = new ReofferResponseService({
    ...base,
    consents,
    reaward: new DrizzleLotReawardRepository(),
    atg,
    place,
    moneyPause,
    invoicing: {
      raiseFor: async (lotId) => {
        control.invoiced.push(lotId);
      },
    },
  });
  const reads = new ReofferReadsService({
    db,
    views: new DrizzleReofferViewsReader(db),
    workflow,
    pricing: {
      priceFor: async ({ hammerPence }) => ({
        lines: [
          { kind: "hammer", amountPence: hammerPence },
          { kind: "buyers_premium", amountPence: Math.round(hammerPence * 0.25) },
        ],
        totalPence: hammerPence + Math.round(hammerPence * 0.25),
      }),
    },
  });

  const member = (who: keyof typeof ids | "seller", role = "owner"): ReofferMemberActor => ({
    userId: who === "seller" ? staffId : ids[who],
    legalEntityId: who === "seller" ? entity.seller : entity[who],
    role: role as ReofferMemberActor["role"],
  });

  /** A defaulted lot: ended, buyer taken off, three more bidders with their own placed bids. */
  async function defaultedLot(opts: { reserve?: string } = {}) {
    const lotId = randomUUID();
    lotIds.push(lotId);
    await db.insert(lot).values({
      id: lotId,
      title: `Reoffer lot ${lotId.slice(0, 4)}`,
      lotNumber: lotIds.length,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "1000.00",
      minBidIncrement: "10.00",
      startTime: new Date("2026-10-01T10:00:00Z"),
      endTime: new Date("2026-10-10T10:00:00Z"),
      status: "ended",
      sellerLegalEntityId: entity.seller,
      winnerId: null,
      buyerLegalEntityId: null,
      ...(opts.reserve ? { reservePrice: opts.reserve } : {}),
    });
    const t = (n: number) => new Date(`2026-10-09T10:0${n}:00Z`);
    const bids = await db
      .insert(bid)
      .values([
        {
          lotId,
          bidderId: ids.buyer,
          buyerLegalEntityId: entity.buyer,
          amount: "1000.00",
          createdAt: t(4),
        },
        // The second bidder's hidden maximum is far above the bid they placed: never the price.
        {
          lotId,
          bidderId: ids.second,
          buyerLegalEntityId: entity.second,
          amount: "900.00",
          maxAutoBidAmount: "2500.00",
          isAutoBid: true,
          createdAt: t(3),
        },
        {
          lotId,
          bidderId: ids.third,
          buyerLegalEntityId: entity.third,
          amount: "800.00",
          createdAt: t(2),
        },
        {
          lotId,
          bidderId: ids.fourth,
          buyerLegalEntityId: entity.fourth,
          amount: "700.00",
          createdAt: t(1),
        },
      ])
      .returning({ id: bid.id });
    const [def] = await db
      .insert(buyerDefault)
      .values({
        lotId,
        buyerId: ids.buyer,
        buyerLegalEntityId: entity.buyer,
        sellerLegalEntityId: entity.seller,
        hammerPrice: "1000.00",
        wonAt: new Date("2026-10-10T10:00:00Z"),
        reason: "No payment",
        outcome: "offered_to_underbidder",
        actorUserId: staffId,
      })
      .returning({ id: buyerDefault.id });
    await db.insert(lotFulfilment).values({ lotId, status: "cancelled" }).onConflictDoNothing();
    return { lotId, defaultId: def?.id as string, bidIds: bids.map((b) => b.id) };
  }

  type Scenario = Awaited<ReturnType<typeof defaultedLot>>;

  /** The bidder's offers for one lot: the test accounts bid on every lot, so each read is narrowed. */
  const bidderOffersFor = async (who: keyof typeof ids, lotId: string) =>
    (await reads.listForBidder(member(who))).filter((v) => v.lotId === lotId);
  const row = async (reofferId: string) =>
    (await db.select().from(lotReoffer).where(eq(lotReoffer.id, reofferId)))[0];
  const lotRow = async (lotId: string) => (await db.select().from(lot).where(eq(lot.id, lotId)))[0];
  const codeOf = async (promise: Promise<unknown>) => {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ReofferError);
    return (error as ReofferError).code;
  };
  const eventTypes = (lotId: string) => events.filter((e) => e.lotId === lotId).map((e) => e.type);

  /** Start, agree and send: an offer that is out to the next bidder. */
  async function sentOffer(s: Scenario, days?: number) {
    const started = await start.start(staff, s.lotId);
    await consent.recordForSeller(staff, started.reofferId, {
      answer: "given",
      note: "Phoned the seller",
    });
    const sent = await offer.send(staff, started.reofferId, { days });
    return { ...started, ...sent };
  }

  async function addPayment(
    lotId: string,
    status: "pending" | "authorized" | "captured" | "cancelled",
  ) {
    await db.insert(payment).values({
      lotId,
      buyerId: ids.second,
      buyerLegalEntityId: entity.second,
      sellerLegalEntityId: entity.seller,
      amount: "1125.00",
      platformFee: "45.00",
      status,
    });
  }

  beforeAll(async () => {
    const people = [staffId, ...Object.values(ids)];
    await seedIdentityUserFixtures(
      db,
      people.map((id) => ({ id, name: id, email: `${id}@integration.test` })),
    );
    for (const id of people) {
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
      [entity.buyer, "individual", "private_collector"],
      [entity.second, "individual", "private_collector"],
      [entity.third, "individual", "private_collector"],
      [entity.fourth, "individual", "private_collector"],
      [entity.seller, "organisation", "gallery"],
      [entity.otherSeller, "organisation", "gallery"],
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
    await db.delete(legalEntity).where(inArray(legalEntity.id, Object.values(entity)));
    const users = [staffId, ...Object.values(ids)];
    await db.delete(bidUserProfile).where(inArray(bidUserProfile.userId, users));
    await db.delete(bidIdentityDirectory).where(inArray(bidIdentityDirectory.subjectId, users));
    await deleteIdentityUserFixtures(db, users);
    await closeDb(db);
  });

  const suspend = (userId: string) =>
    db
      .insert(bidUserProfile)
      .values({ userId, suspendedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });

  // Each test starts from a clean outside world.
  const reset = () => {
    clock.now = T0;
    control.soldOnAtg = false;
    control.placeRefusal = null;
    control.paused = null;
    control.pauseCalls.length = 0;
    control.laxOwned = false;
    control.invoiced.length = 0;
    control.pricedFor.length = 0;
  };

  describe("starting an offer", () => {
    it("offers at the underbidder's placed bid, never at a hidden maximum (RA6)", async () => {
      reset();
      const s = await defaultedLot();
      const started = await start.start(staff, s.lotId);
      expect(started).toMatchObject({
        sequence: 1,
        status: "awaiting_seller",
        amountPence: 90_000,
      });
      const stored = await row(started.reofferId);
      expect(stored?.offeredUserId).toBe(ids.second);
      expect(stored?.sourceBidId).toBe(s.bidIds[1]);
      expect(stored?.amountPence).toBe(90_000);
    });

    it("asks the seller, due 17:00 London on the 3rd working day, and says so in an id-only event", async () => {
      reset();
      const s = await defaultedLot({ reserve: "950.00" });
      const started = await start.start(staff, s.lotId);
      // Wednesday asked: Thursday, Friday, Monday.
      expect(started.consentDueAt?.toISOString()).toBe("2026-11-16T17:00:00.000Z");
      const request = await consents.findForReoffer(started.reofferId);
      expect(request).toMatchObject({
        status: "requested",
        termsSnapshot: {
          amountPence: 90_000,
          originalHammerPence: 100_000,
          saleAtOfferPence: 112_500,
          proceedsAtOfferPence: 106_875,
          proceedsAtOriginalPence: 118_750,
          // A reserve above the offer is carried as evidence; it never stops the request.
          reservePence: 95_000,
        },
      });
      // Each figure is priced for the buyer who would pay it: the next bidder, and the original.
      expect(control.pricedFor).toEqual([
        { buyerLegalEntityId: entity.second, hammerPence: 90_000 },
        { buyerLegalEntityId: entity.buyer, hammerPence: 100_000 },
      ]);
      const started1 = events.find((e) => e.lotId === s.lotId && e.type === "lot.reoffer_started");
      expect(started1?.payload).toMatchObject({
        reofferId: started.reofferId,
        actor: "staff",
        consentStatus: "requested",
        originalHammerPence: 100_000,
      });
      // No names, emails or notes: ids and pence only.
      expect(JSON.stringify(started1?.payload)).not.toMatch(/@|Entity [0-9a-f]{4}|No payment/);
    });

    it("needs no seller answer for stock LAX owns: the offer is ready to send", async () => {
      reset();
      control.laxOwned = true;
      const s = await defaultedLot();
      const started = await start.start(staff, s.lotId);
      expect(started).toMatchObject({
        status: "ready",
        consentStatus: "not_needed",
        consentDueAt: null,
      });
      const sent = await offer.send(staff, started.reofferId);
      expect(sent.offerEndsAt).toBeInstanceOf(Date);
    });

    it("passes over a suspended bidder and says so (RA)", async () => {
      reset();
      const s = await defaultedLot();
      await suspend(ids.second);
      try {
        const started = await start.start(staff, s.lotId);
        expect(started.amountPence).toBe(80_000);
        expect(started.skippedBidders).toEqual([
          {
            userId: ids.second,
            legalEntityId: entity.second,
            amountMinor: 90_000,
            reason: "suspended",
          },
        ]);
        expect((await row(started.reofferId))?.offeredUserId).toBe(ids.third);
      } finally {
        await db.delete(bidUserProfile).where(eq(bidUserProfile.userId, ids.second));
      }
    });

    it("refuses a staff member without the buyer-default permission", async () => {
      reset();
      const s = await defaultedLot();
      const clerk: ReofferStaffActor = {
        userId: staffId,
        role: "staff",
        staffRoles: ["saleroom_clerk"],
      };
      expect(await codeOf(start.start(clerk, s.lotId))).toBe("forbidden");
      expect(await row(s.defaultId)).toBeUndefined();
    });

    it("allows one open offer at a time, even when two staff start at once (RA12)", async () => {
      reset();
      const s = await defaultedLot();
      const results = await Promise.allSettled([
        start.start(staff, s.lotId),
        start.start(staff, s.lotId),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect((failed.reason as ReofferError).code).toBe("open_offer_exists");
      const stored = await db.select().from(lotReoffer).where(eq(lotReoffer.lotId, s.lotId));
      expect(stored).toHaveLength(1);
    });

    it("refuses a lot ATG sold (RA19)", async () => {
      reset();
      control.soldOnAtg = true;
      const s = await defaultedLot();
      expect(await codeOf(start.start(staff, s.lotId))).toBe("sold_on_atg");
    });

    it("refuses a lot that was not defaulted, and one defaulted again since the page loaded", async () => {
      reset();
      const s = await defaultedLot();
      await db
        .update(lot)
        .set({ winnerId: ids.second, buyerLegalEntityId: entity.second })
        .where(eq(lot.id, s.lotId));
      expect(await codeOf(start.start(staff, s.lotId))).toBe("buyer_default_not_recorded");
      await db
        .update(lot)
        .set({ winnerId: null, buyerLegalEntityId: null })
        .where(eq(lot.id, s.lotId));
      expect(await codeOf(start.start(staff, s.lotId, { buyerDefaultId: randomUUID() }))).toBe(
        "default_not_latest",
      );
    });

    it.each(["captured", "authorized"] as const)(
      "never starts on a lot with a %s payment (money rule)",
      async (status) => {
        reset();
        const s = await defaultedLot();
        await addPayment(s.lotId, status);
        expect(await codeOf(start.start(staff, s.lotId))).toBe("payment_in_progress");
        expect(
          await db.select().from(lotReoffer).where(eq(lotReoffer.lotId, s.lotId)),
        ).toHaveLength(0);
      },
    );

    it("stops at three offers a default (RA12), counting only those a bidder received", async () => {
      reset();
      const s = await defaultedLot();
      for (const who of ["second", "third", "fourth"] as const) {
        const out = await sentOffer(s);
        expect((await row(out.reofferId))?.offeredUserId).toBe(ids[who]);
        await response.decline(member(who), out.reofferId, {});
      }
      expect(await codeOf(start.start(staff, s.lotId))).toBe("offer_limit_reached");
    });
  });

  describe("the seller's answer", () => {
    it("needs a note when staff record it, and the permission to manage auctions (RA3)", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      expect(
        await codeOf(consent.recordForSeller(staff, reofferId, { answer: "given", note: "  " })),
      ).toBe("note_required");
      const finance: ReofferStaffActor = {
        userId: staffId,
        role: "staff",
        staffRoles: ["finance"],
      };
      expect(
        await codeOf(consent.recordForSeller(finance, reofferId, { answer: "given", note: "x" })),
      ).toBe("forbidden");
      expect((await row(reofferId))?.status).toBe("awaiting_seller");
    });

    it("records a yes as ready to send, with the channel and the note (RA2)", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      const result = await consent.recordForSeller(staff, reofferId, {
        answer: "given",
        note: "Emailed 11 Nov",
      });
      expect(result).toMatchObject({ consentStatus: "given", offerStatus: "ready" });
      expect(await consents.findForReoffer(reofferId)).toMatchObject({
        status: "given",
        channel: "recorded_by_staff",
        note: "Emailed 11 Nov",
        answeredByUserId: staffId,
      });
      expect(eventTypes(s.lotId)).toContain("lot.seller_consent_given");
    });

    it("records a refusal with what the seller prefers, and offers no further bidder (RA5)", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      const result = await consent.recordForSeller(staff, reofferId, {
        answer: "refused",
        note: "Said no by phone",
        preferredNext: "later_sale",
      });
      expect(result.offerStatus).toBe("seller_declined");
      expect((await consents.findForReoffer(reofferId))?.preferredNext).toBe("later_sale");
      expect(await codeOf(start.start(staff, s.lotId))).toBe("seller_declined_last_offer");
    });

    it("is answered once", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      await consent.recordForSeller(staff, reofferId, { answer: "given", note: "yes" });
      expect(
        await codeOf(consent.recordForSeller(staff, reofferId, { answer: "refused", note: "no" })),
      ).toBe("consent_already_answered");
    });

    it("asks again for every offer: the next bidder's offer waits on its own answer (RA13)", async () => {
      reset();
      const s = await defaultedLot();
      const first = await sentOffer(s);
      await response.decline(member("second"), first.reofferId, {});
      const next = await start.start(staff, s.lotId);
      expect(next).toMatchObject({
        sequence: 2,
        status: "awaiting_seller",
        consentStatus: "requested",
      });
      expect(await codeOf(offer.send(staff, next.reofferId))).toBe("offer_not_ready");
    });

    it("lets the seller answer from their workspace, but not another account or a lesser role", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      const intruder: ReofferMemberActor = {
        ...member("seller"),
        legalEntityId: entity.otherSeller,
      };
      expect(
        await codeOf(consent.answerInWorkspace(intruder, reofferId, { answer: "given" })),
      ).toBe("offer_not_found");
      expect(
        await codeOf(
          consent.answerInWorkspace(member("seller", "finance"), reofferId, { answer: "given" }),
        ),
      ).toBe("forbidden");
      const done = await consent.answerInWorkspace(member("seller"), reofferId, {
        answer: "given",
      });
      expect(done.offerStatus).toBe("ready");
      expect(await consents.findForReoffer(reofferId)).toMatchObject({
        channel: "workspace",
        note: null,
      });
    });

    it("stops a seller answering from the workspace after the deadline, not staff recording one", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      clock.now = new Date("2026-11-16T17:00:00.000Z");
      expect(
        await codeOf(consent.answerInWorkspace(member("seller"), reofferId, { answer: "given" })),
      ).toBe("consent_window_ended");
      await consent.recordForSeller(staff, reofferId, {
        answer: "given",
        note: "Rang us at 17:05",
      });
    });

    it("lets staff record a late answer on a lapsed request, only while no later offer exists", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      await db
        .update(lotReoffer)
        .set({ status: "seller_lapsed" })
        .where(eq(lotReoffer.id, reofferId));
      await db
        .update(sellerConsent)
        .set({ status: "lapsed" })
        .where(eq(sellerConsent.subjectId, reofferId));
      expect(
        await codeOf(consent.answerInWorkspace(member("seller"), reofferId, { answer: "given" })),
      ).toBe("consent_already_answered");
      const late = await consent.recordForSeller(staff, reofferId, {
        answer: "given",
        note: "Late yes",
      });
      expect(late.offerStatus).toBe("ready");
    });
  });

  describe("sending the offer", () => {
    it("is refused before the seller has agreed, and after a withdrawal", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      expect(await codeOf(offer.send(staff, reofferId))).toBe("offer_not_ready");
      await offer.withdraw(staff, reofferId, { reason: "Seller away" });
      expect((await row(reofferId))?.status).toBe("withdrawn");
      expect(await codeOf(offer.send(staff, reofferId))).toBe("offer_not_ready");
    });

    it("gives three days by default, ending at 17:00 London (RA8)", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      expect(out.offerSentAt).toEqual(T0);
      expect(out.offerEndsAt.toISOString()).toBe("2026-11-14T17:00:00.000Z");
      expect((await row(out.reofferId))?.status).toBe("offered");
      expect(eventTypes(s.lotId)).toContain("lot.reoffer_sent");
    });

    it("lets staff choose 1 to 7 days and nothing else (RA9)", async () => {
      reset();
      const s = await defaultedLot();
      const started = await start.start(staff, s.lotId);
      await consent.recordForSeller(staff, started.reofferId, { answer: "given", note: "yes" });
      expect(await codeOf(offer.send(staff, started.reofferId, { days: 0 }))).toBe(
        "invalid_offer_days",
      );
      expect(await codeOf(offer.send(staff, started.reofferId, { days: 8 }))).toBe(
        "invalid_offer_days",
      );
      const sent = await offer.send(staff, started.reofferId, { days: 7 });
      expect(sent.offerEndsAt.toISOString()).toBe("2026-11-18T17:00:00.000Z");
    });

    it("sends only to a bidder who can still be offered the lot, at their own bid", async () => {
      reset();
      const s = await defaultedLot();
      const started = await start.start(staff, s.lotId);
      await consent.recordForSeller(staff, started.reofferId, { answer: "given", note: "yes" });
      await suspend(ids.second);
      try {
        expect(await codeOf(offer.send(staff, started.reofferId))).toBe("bidder_unavailable");
      } finally {
        await db.delete(bidUserProfile).where(eq(bidUserProfile.userId, ids.second));
      }
      expect((await row(started.reofferId))?.status).toBe("ready");
    });

    it("calls the money-pause hook with reoffer_send, and a pause refuses before anything is written", async () => {
      reset();
      const s = await defaultedLot();
      const started = await start.start(staff, s.lotId);
      await consent.recordForSeller(staff, started.reofferId, { answer: "given", note: "yes" });
      control.paused = "Money movement is paused.";
      expect(await codeOf(offer.send(staff, started.reofferId))).toBe("money_paused");
      expect(control.pauseCalls).toEqual([{ step: "reoffer_send", lotId: s.lotId }]);
      expect((await row(started.reofferId))?.status).toBe("ready");
      control.paused = null;
      await offer.send(staff, started.reofferId);
      expect((await row(started.reofferId))?.status).toBe("offered");
    });

    it("refuses when the artwork is offered or sold elsewhere, with the lock's message (IC6/Q7)", async () => {
      reset();
      const s = await defaultedLot();
      const started = await start.start(staff, s.lotId);
      await consent.recordForSeller(staff, started.reofferId, { answer: "given", note: "yes" });
      control.placeRefusal =
        "Zoho shows this artwork as sold in the gallery, so it can't be offered.";
      const error = await offer.send(staff, started.reofferId).then(
        () => null,
        (e: unknown) => e as ReofferError,
      );
      expect(error?.code).toBe("artwork_offered_elsewhere");
      expect(error?.message).toBe(control.placeRefusal);
      expect((await row(started.reofferId))?.status).toBe("ready");
    });

    it("refuses a lot ATG sold since the offer was made (RA19)", async () => {
      reset();
      const s = await defaultedLot();
      const started = await start.start(staff, s.lotId);
      await consent.recordForSeller(staff, started.reofferId, { answer: "given", note: "yes" });
      control.soldOnAtg = true;
      expect(await codeOf(offer.send(staff, started.reofferId))).toBe("sold_on_atg");
    });

    it("never sends for a lot that has a paid or being-paid payment (money rule)", async () => {
      reset();
      const s = await defaultedLot();
      const started = await start.start(staff, s.lotId);
      await consent.recordForSeller(staff, started.reofferId, { answer: "given", note: "yes" });
      await addPayment(s.lotId, "captured");
      expect(await codeOf(offer.send(staff, started.reofferId))).toBe("payment_in_progress");
      expect((await row(started.reofferId))?.status).toBe("ready");
    });

    it("withdraws an open offer with a reason, and not one already answered", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      expect(await codeOf(offer.withdraw(staff, out.reofferId, { reason: " " }))).toBe(
        "note_required",
      );
      await offer.withdraw(staff, out.reofferId, { reason: "Seller changed their mind" });
      expect(await row(out.reofferId)).toMatchObject({
        status: "withdrawn",
        closedBy: staffId,
        closeReason: "Seller changed their mind",
      });
      expect(await codeOf(offer.withdraw(staff, out.reofferId, { reason: "again" }))).toBe(
        "offer_not_open",
      );
      expect(eventTypes(s.lotId)).toContain("lot.reoffer_withdrawn");
    });
  });

  describe("the bidder's answer", () => {
    it("accepts a binding offer: the lot is theirs at their bid, with a fresh unpaid sale (RA10)", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      clock.now = new Date(T0.getTime() + HOUR);
      expect(
        await codeOf(response.accept(member("second"), out.reofferId, { termsAccepted: false })),
      ).toBe("terms_not_accepted");
      const accepted = await response.accept(member("second"), out.reofferId, {
        termsAccepted: true,
      });
      expect(accepted).toMatchObject({ lotId: s.lotId, amountPence: 90_000 });
      // The invoice is due seven days on, to the end of that London day (RA10).
      expect(accepted.invoiceDueAt.toISOString()).toBe("2026-11-18T23:59:59.999Z");
      expect(control.invoiced).toEqual([s.lotId]);
      expect(control.pauseCalls.map((c) => c.step)).toEqual(["reoffer_send", "reoffer_accept"]);

      const won = await lotRow(s.lotId);
      expect(won).toMatchObject({
        winnerId: ids.second,
        buyerLegalEntityId: entity.second,
        status: "ended",
      });
      expect(String(won?.currentPrice)).toBe("900.00");
      const [fulfilment] = await db
        .select()
        .from(lotFulfilment)
        .where(eq(lotFulfilment.lotId, s.lotId));
      expect(fulfilment?.status).toBe("awaiting_payment");
      expect((await row(out.reofferId))?.status).toBe("accepted");
      const types = eventTypes(s.lotId);
      expect(types).toContain("lot.reoffer_accepted");
      expect(types).toContain("lot.reawarded");
    });

    it("keeps the original hammer on the default and never reopens the default's other offers", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      await response.accept(member("second"), out.reofferId, { termsAccepted: true });
      const [original] = await db
        .select()
        .from(buyerDefault)
        .where(eq(buyerDefault.id, s.defaultId));
      expect(String(original?.hammerPrice)).toBe("1000.00");
      expect(await codeOf(start.start(staff, s.lotId))).toBe("buyer_default_not_recorded");
    });

    it("declines with an optional reason, leaving the lot for staff to offer on", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      await response.decline(member("second"), out.reofferId, { reason: "Not interested now" });
      expect(await row(out.reofferId)).toMatchObject({
        status: "declined",
        declineReason: "Not interested now",
      });
      expect((await lotRow(s.lotId))?.winnerId).toBeNull();
      expect(eventTypes(s.lotId)).toContain("lot.reoffer_declined");
      expect(
        await codeOf(response.accept(member("second"), out.reofferId, { termsAccepted: true })),
      ).toBe("offer_not_open");
    });

    it("is for the offered account only, and for members who may bid for it", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      expect(
        await codeOf(response.accept(member("third"), out.reofferId, { termsAccepted: true })),
      ).toBe("offer_not_found");
      expect(
        await codeOf(
          response.accept(member("second", "finance"), out.reofferId, { termsAccepted: true }),
        ),
      ).toBe("forbidden");
      expect((await row(out.reofferId))?.status).toBe("offered");
    });

    it("cannot be answered once the window has ended, even before the clock closes the offer", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      clock.now = out.offerEndsAt;
      expect(
        await codeOf(response.accept(member("second"), out.reofferId, { termsAccepted: true })),
      ).toBe("offer_window_ended");
      expect(await codeOf(response.decline(member("second"), out.reofferId, {}))).toBe(
        "offer_window_ended",
      );
      expect((await lotRow(s.lotId))?.winnerId).toBeNull();
    });

    it("cannot accept a withdrawn offer", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      await offer.withdraw(staff, out.reofferId, { reason: "Seller changed their mind" });
      expect(
        await codeOf(response.accept(member("second"), out.reofferId, { termsAccepted: true })),
      ).toBe("offer_not_open");
    });

    it("checks the pause guard, the artwork's place and ATG when accepting (IC6/Q7, RA19)", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      control.paused = "Paused";
      expect(
        await codeOf(response.accept(member("second"), out.reofferId, { termsAccepted: true })),
      ).toBe("money_paused");
      control.paused = null;
      control.placeRefusal = "This artwork is in a private sale. Withdraw it there first.";
      expect(
        await codeOf(response.accept(member("second"), out.reofferId, { termsAccepted: true })),
      ).toBe("artwork_offered_elsewhere");
      control.placeRefusal = null;
      control.soldOnAtg = true;
      expect(
        await codeOf(response.accept(member("second"), out.reofferId, { termsAccepted: true })),
      ).toBe("sold_on_atg");
      // Nothing moved: the offer is still out and the lot still has no buyer.
      expect((await row(out.reofferId))?.status).toBe("offered");
      expect((await lotRow(s.lotId))?.winnerId).toBeNull();
    });
  });

  describe("money races", () => {
    it("never re-awards a lot with a paid payment, and rolls the acceptance back (money rule)", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      await addPayment(s.lotId, "captured");
      expect(
        await codeOf(response.accept(member("second"), out.reofferId, { termsAccepted: true })),
      ).toBe("payment_in_progress");
      expect((await row(out.reofferId))?.status).toBe("offered");
      expect((await lotRow(s.lotId))?.winnerId).toBeNull();
      expect(control.invoiced).toEqual([]);
    });

    it("accept racing a payment that lands under the lot lock: the lot is never awarded (money rule)", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      let release = () => {};
      const paymentHeld = new Promise<void>((resolve) => {
        release = resolve;
      });
      let locked = () => {};
      const gotLock = new Promise<void>((resolve) => {
        locked = resolve;
      });
      // The payment path holds the lot lock, records the capture and only then commits.
      const paying = db.transaction(async (tx) => {
        await tx.select({ id: lot.id }).from(lot).where(eq(lot.id, s.lotId)).for("update");
        locked();
        await tx.insert(payment).values({
          lotId: s.lotId,
          buyerId: ids.buyer,
          buyerLegalEntityId: entity.buyer,
          sellerLegalEntityId: entity.seller,
          amount: "1250.00",
          platformFee: "50.00",
          status: "captured",
        });
        await paymentHeld;
      });
      await gotLock;
      const accepting = response
        .accept(member("second"), out.reofferId, { termsAccepted: true })
        .then(
          () => "accepted",
          (e: unknown) => (e as ReofferError).code,
        );
      await new Promise((resolve) => setTimeout(resolve, 150));
      release();
      await paying;
      expect(await accepting).toBe("payment_in_progress");
      expect((await lotRow(s.lotId))?.winnerId).toBeNull();
      expect((await row(out.reofferId))?.status).toBe("offered");
    });

    it("two accepts of one offer award the lot once, and both answer success for the same account", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      const results = await Promise.allSettled([
        response.accept(member("second"), out.reofferId, { termsAccepted: true }),
        response.accept(member("second"), out.reofferId, { termsAccepted: true }),
      ]);
      expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
      const [a, b] = results as PromiseFulfilledResult<{ reofferId: string; acceptedAt: Date }>[];
      expect(a?.value.reofferId).toBe(b?.value.reofferId);
      expect(a?.value.acceptedAt).toEqual(b?.value.acceptedAt);
      expect(events.filter((e) => e.lotId === s.lotId && e.type === "lot.reawarded")).toHaveLength(
        1,
      );
      expect(control.invoiced).toEqual([s.lotId]);
      expect((await lotRow(s.lotId))?.winnerId).toBe(ids.second);
    });

    it("a later repeat accept by the same account returns the same result; another account is refused", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      const first = await response.accept(member("second"), out.reofferId, { termsAccepted: true });
      const again = await response.accept(member("second"), out.reofferId, { termsAccepted: true });
      expect(again).toEqual(first);
      expect(
        await codeOf(response.accept(member("third"), out.reofferId, { termsAccepted: true })),
      ).toBe("offer_not_found");
      expect(events.filter((e) => e.lotId === s.lotId && e.type === "lot.reawarded")).toHaveLength(
        1,
      );
      expect(control.invoiced).toEqual([s.lotId]);
    });

    it("refuses an accept once the bidder's account is restricted, and does not re-award", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      await suspend(ids.second);
      try {
        expect(
          await codeOf(response.accept(member("second"), out.reofferId, { termsAccepted: true })),
        ).toBe("bidder_unavailable");
      } finally {
        await db.delete(bidUserProfile).where(eq(bidUserProfile.userId, ids.second));
      }
      expect((await row(out.reofferId))?.status).toBe("offered");
      expect((await lotRow(s.lotId))?.winnerId).not.toBe(ids.second);
      expect(control.invoiced).toEqual([]);
    });

    it("accept racing a withdrawal ends one way: the lot is awarded or the offer is withdrawn, never both", async () => {
      reset();
      const s = await defaultedLot();
      const out = await sentOffer(s);
      const [accepted, withdrawn] = await Promise.allSettled([
        response.accept(member("second"), out.reofferId, { termsAccepted: true }),
        offer.withdraw(staff, out.reofferId, { reason: "Withdrawn at the same moment" }),
      ]);
      const stored = await row(out.reofferId);
      const won = (await lotRow(s.lotId))?.winnerId === ids.second;
      expect(accepted?.status === "fulfilled" && withdrawn?.status === "fulfilled").toBe(false);
      expect(stored?.status).toBe(won ? "accepted" : "withdrawn");
    });

    it("default, re-award, second default: the old offer never wins the lot again", async () => {
      reset();
      const s = await defaultedLot();
      const first = await sentOffer(s);
      await response.accept(member("second"), first.reofferId, { termsAccepted: true });
      // The new buyer defaults too: the sale is voided and the winner taken off, as the default does.
      await db
        .update(lot)
        .set({ winnerId: null, buyerLegalEntityId: null })
        .where(eq(lot.id, s.lotId));
      await db.update(bid).set({ isWinning: false }).where(eq(bid.lotId, s.lotId));
      const [again] = await db
        .insert(buyerDefault)
        .values({
          lotId: s.lotId,
          buyerId: ids.second,
          buyerLegalEntityId: entity.second,
          sellerLegalEntityId: entity.seller,
          hammerPrice: "900.00",
          wonAt: new Date("2026-11-11T11:00:00Z"),
          reason: "No payment",
          outcome: "offered_to_underbidder",
          actorUserId: staffId,
          createdAt: new Date(Date.now() + 5_000),
        })
        .returning({ id: buyerDefault.id });
      // The old offer is history: answering it again is refused, and starts are for the new default.
      expect(
        await codeOf(response.accept(member("second"), first.reofferId, { termsAccepted: true })),
      ).toBe("offer_not_open");
      expect(await codeOf(start.start(staff, s.lotId, { buyerDefaultId: s.defaultId }))).toBe(
        "default_not_latest",
      );
      const next = await start.start(staff, s.lotId, { buyerDefaultId: again?.id });
      // The new default's own bidders: the buyer who just defaulted is never offered it.
      expect((await row(next.reofferId))?.offeredUserId).not.toBe(ids.second);
      expect((await row(next.reofferId))?.buyerDefaultId).toBe(again?.id);
      expect((await lotRow(s.lotId))?.winnerId).toBeNull();
    });
  });

  describe("who sees what (RA16)", () => {
    it("shows the seller the terms and never the bidder or the defaulting buyer", async () => {
      reset();
      const s = await defaultedLot({ reserve: "950.00" });
      const { reofferId } = await start.start(staff, s.lotId);
      const mine = await reads.listForSeller(member("seller"));
      const view = mine.find((v) => v.id === reofferId);
      expect(view).toMatchObject({
        status: "awaiting_seller",
        consentStatus: "requested",
        offerMinor: 90_000,
        proceeds: {
          offerSaleMinor: 112_500,
          offerProceedsMinor: 106_875,
          originalHammerMinor: 100_000,
          originalProceedsMinor: 118_750,
        },
        reserveMinor: 95_000,
        belowReserve: true,
        lotTitle: `Reoffer lot ${s.lotId.slice(0, 4)}`,
        lotEndedAt: "2026-10-10T10:00:00.000Z",
        answeredAt: null,
        answeredBy: null,
        soldAt: null,
      });
      const text = JSON.stringify(view);
      for (const secret of [ids.second, ids.buyer, entity.second, entity.buyer, "Entity"]) {
        expect(text).not.toContain(secret);
      }
      expect(
        await reads.listForSeller({ ...member("seller"), legalEntityId: entity.otherSeller }),
      ).toEqual([]);
      expect(await codeOf(reads.listForSeller(member("seller", "buyer_agent")))).toBe("forbidden");
    });

    it("gives the seller's money only to the members who see its payouts", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      for (const role of ["owner", "admin", "finance"]) {
        const view = await reads.getForSeller(member("seller", role), reofferId);
        expect(view.proceeds?.offerProceedsMinor).toBe(106_875);
      }
      for (const role of ["viewer", "consignor"]) {
        const view = await reads.getForSeller(member("seller", role), reofferId);
        const listed = (await reads.listForSeller(member("seller", role))).find(
          (v) => v.id === reofferId,
        );
        expect(view.proceeds).toBeNull();
        expect(listed?.proceeds).toBeNull();
        expect(view.offerMinor).toBe(90_000);
        expect(JSON.stringify([view, listed])).not.toMatch(/106875|118750|112500/);
      }
    });

    it("waits on the seller until answered, then says how the answer reached us", async () => {
      reset();
      const facts = new DrizzleNeedsYouFactsReader(db);
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      const waiting = await facts.reofferRequests({
        legalEntityId: entity.seller,
        now: clock.now,
        limit: 50,
      });
      expect(waiting.find((request) => request.id === reofferId)).toMatchObject({
        title: `Reoffer lot ${s.lotId.slice(0, 4)}`,
        offerMinor: 90_000,
      });
      expect(
        await facts.reofferRequests({
          legalEntityId: entity.otherSeller,
          now: clock.now,
          limit: 50,
        }),
      ).toEqual([]);
      await consent.recordForSeller(staff, reofferId, { answer: "given", note: "Phoned" });
      const view = (await reads.listForSeller(member("seller"))).find((v) => v.id === reofferId);
      expect(view).toMatchObject({ answeredBy: "recorded_by_staff", consentStatus: "given" });
      expect(view?.answeredAt).not.toBeNull();
      const after = await facts.reofferRequests({
        legalEntityId: entity.seller,
        now: clock.now,
        limit: 50,
      });
      expect(after.some((request) => request.id === reofferId)).toBe(false);
    });

    it("drops a request from Needs you once its deadline has passed, before the worker lapses it", async () => {
      reset();
      const facts = new DrizzleNeedsYouFactsReader(db);
      const s = await defaultedLot();
      const { reofferId, consentDueAt } = await start.start(staff, s.lotId);
      if (!consentDueAt) throw new Error("expected a deadline");
      const ids = async (now: Date) =>
        (await facts.reofferRequests({ legalEntityId: entity.seller, now, limit: 50 })).map(
          (request) => request.id,
        );
      expect(await ids(new Date(consentDueAt.getTime() - 60_000))).toContain(reofferId);
      // Still `requested` and `awaiting_seller` in the store, but no longer answerable.
      expect(await ids(consentDueAt)).not.toContain(reofferId);
      expect(await ids(new Date(consentDueAt.getTime() + HOUR))).not.toContain(reofferId);
      const [stored] = await db
        .select({ status: sellerConsent.status })
        .from(sellerConsent)
        .where(eq(sellerConsent.subjectId, reofferId));
      expect(stored?.status).toBe("requested");
    });

    it("shows the bidder nothing until the offer is sent, then the price lines and window, never the seller", async () => {
      reset();
      const s = await defaultedLot();
      const started = await start.start(staff, s.lotId);
      expect(await bidderOffersFor("second", s.lotId)).toEqual([]);
      await consent.recordForSeller(staff, started.reofferId, { answer: "given", note: "yes" });
      expect(await bidderOffersFor("second", s.lotId)).toEqual([]);
      await offer.send(staff, started.reofferId);
      const [view] = await bidderOffersFor("second", s.lotId);
      expect(view).toEqual({
        id: started.reofferId,
        lotId: s.lotId,
        status: "offered",
        price: {
          hammerMinor: 90_000,
          buyersPremiumMinor: 22_500,
          vatOnPremiumMinor: 0,
          vatOnLotMinor: null,
          artistsResaleRightMinor: null,
          totalMinor: 112_500,
        },
        endsAt: "2026-11-14T17:00:00.000Z",
      });
      const text = JSON.stringify(view);
      for (const secret of [entity.seller, ids.buyer, entity.buyer, "Reoffer lot"]) {
        expect(text).not.toContain(secret);
      }
      // Another account cannot read it.
      expect(await bidderOffersFor("third", s.lotId)).toEqual([]);
      expect(await codeOf(reads.getForBidder(member("third"), started.reofferId))).toBe(
        "offer_not_found",
      );
    });

    it("shows staff the bidder, the answer and the shortfall; the seller's refusal is hidden from the bidder", async () => {
      reset();
      const s = await defaultedLot();
      const { reofferId } = await start.start(staff, s.lotId);
      await consent.recordForSeller(staff, reofferId, {
        answer: "refused",
        note: "No",
        preferredNext: "talk_to_us",
      });
      const [view] = await reads.listForLot(s.lotId);
      expect(view).toMatchObject({
        id: reofferId,
        status: "seller_declined",
        consentStatus: "refused",
        bidder: { userId: ids.second, legalEntityId: entity.second },
        offerMinor: 90_000,
        originalHammerMinor: 100_000,
        // The hammer drop (£100) plus the premium the failed sale would have earned (£250).
        claimableShortfall: {
          hammerDifferenceMinor: 10_000,
          premiumLostMinor: 25_000,
          totalMinor: 35_000,
        },
      });
      expect(await bidderOffersFor("second", s.lotId)).toEqual([]);
    });
  });
});
