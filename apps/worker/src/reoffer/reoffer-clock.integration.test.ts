import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import {
  bid,
  bidIdentityDirectory,
  buyerDefault,
  domainEvent,
  legalEntity,
  lot,
  lotFulfilment,
  lotLifecycleSnapshot,
  lotReoffer,
  notificationOutbox,
  payment,
  sellerConsent,
  user,
} from "@auction/db/schema";
import { LotReawardRefusedError, type SellerConsentTerms } from "@auction/persistence/interfaces";
import {
  DrizzleLotReawardRepository,
  DrizzleLotReofferRepository,
  DrizzleReofferSweepReader,
  DrizzleReofferWorkflowReader,
  DrizzleTransactionRunner,
} from "@auction/persistence/repositories";
import { and, eq, inArray, like } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createReofferClock } from "../container/create-reoffer-clock.js";
import { runReofferSweepJob } from "../jobs/reoffer-sweep.js";
import { WorkerDomainEventPublisher } from "../lib/domain-event-publisher.js";
import { WorkerDomainEventSink } from "../lib/worker-domain-event-sink.js";
import { DrizzleCollectionNoticeReader } from "../repositories/drizzle-collection-notice.reader.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

const terms: SellerConsentTerms = {
  amountPence: 90_000,
  originalHammerPence: 100_000,
  proceedsAtOfferPence: 72_000,
  proceedsAtOriginalPence: 80_000,
  reservePence: null,
};

const at = (iso: string) => new Date(iso);

// Asked Mon 2 Nov 2026 10:00 London (GMT): reminder Wed 4 Nov 17:00, due Thu 5 Nov 17:00.
const ASKED = at("2026-11-02T10:00:00Z");
const REMIND_AT = at("2026-11-04T17:00:00Z");
const DUE = at("2026-11-05T17:00:00Z");
// An offer sent Mon 2 Nov 10:00 ends Thu 5 Nov 17:00 and is reminded from Wed 4 Nov 17:00.
const SENT = at("2026-11-02T10:00:00Z");
const ENDS = at("2026-11-05T17:00:00Z");
const BEFORE_REMINDER = at("2026-11-04T12:00:00Z");
const IN_LAST_DAY = at("2026-11-04T18:00:00Z");
const AFTER_END = at("2026-11-05T17:00:01Z");

/**
 * The re-offer clock against real rows, run as `worker_app`: what the column grants allow is what
 * the steps may write. Covers the steps, their idempotence, the racing of two clocks, and of the
 * clock against an accept that holds the lot's lock. Skipped where the roles are not set up.
 */
describe.skipIf(!ownerUrl || !workerUrl)(
  "re-offer clock as worker_app (integration)",
  { timeout: 60_000 },
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated above
    const owner = createDb(ownerUrl!);
    // biome-ignore lint/style/noNonNullAssertion: gated above
    const workerDb = createDb(workerUrl!);
    const run = randomUUID().slice(0, 8);
    const log = pino({ level: "silent" });

    const staffId = `rc-staff-${run}`;
    const defaulterId = `rc-defaulter-${run}`;
    const bidderId = `rc-bidder-${run}`;
    const sellerUserId = `rc-seller-${run}`;
    const defaulterEntity = randomUUID();
    const bidderEntity = randomUUID();
    const sellerEntity = randomUUID();
    const lotIds: string[] = [];

    let currentNow = BEFORE_REMINDER;
    const sink = new WorkerDomainEventSink(
      new WorkerDomainEventPublisher({ publishValidateMode: "enforce" }),
      workerDb,
    );
    const { clock, reader, marker } = createReofferClock({
      db: workerDb,
      transactionRunner: new DrizzleTransactionRunner(workerDb),
      domainEventSink: sink,
      people: new DrizzleCollectionNoticeReader(workerDb),
      now: () => currentNow,
    });
    const workflow = new DrizzleReofferWorkflowReader();
    const offers = new DrizzleLotReofferRepository();
    const reaward = new DrizzleLotReawardRepository();

    /** A defaulted lot (ended, no buyer) with the defaulter's bid and the bidder's underbid. */
    async function defaultedLot() {
      const lotId = randomUUID();
      lotIds.push(lotId);
      await owner.insert(lot).values({
        id: lotId,
        title: `Clock ${lotId.slice(0, 4)}`,
        images: [],
        auctionType: "english",
        startingPrice: "100.00",
        currentPrice: "1000.00",
        minBidIncrement: "10.00",
        startTime: at("2026-10-01T10:00:00Z"),
        endTime: at("2026-10-10T10:00:00Z"),
        status: "ended",
        sellerLegalEntityId: sellerEntity,
        winnerId: null,
        buyerLegalEntityId: null,
      });
      const [, underbid] = await owner
        .insert(bid)
        .values([
          { lotId, bidderId: defaulterId, buyerLegalEntityId: defaulterEntity, amount: "1000.00" },
          { lotId, bidderId, buyerLegalEntityId: bidderEntity, amount: "900.00" },
        ])
        .returning({ id: bid.id });
      const [def] = await owner
        .insert(buyerDefault)
        .values({
          lotId,
          buyerId: defaulterId,
          buyerLegalEntityId: defaulterEntity,
          sellerLegalEntityId: sellerEntity,
          hammerPrice: "1000.00",
          wonAt: at("2026-10-10T10:00:00Z"),
          reason: "No payment",
          outcome: "offered_to_underbidder",
          actorUserId: staffId,
        })
        .returning({ id: buyerDefault.id });
      await owner
        .insert(lotFulfilment)
        .values({ lotId, status: "cancelled", paymentId: null })
        .onConflictDoNothing();
      return { lotId, defaultId: def?.id as string, sourceBidId: underbid?.id as string };
    }
    type Scenario = Awaited<ReturnType<typeof defaultedLot>>;

    type OfferSetup = {
      status: "awaiting_seller" | "ready" | "offered" | "accepted";
      consentStatus?: "requested" | "given" | "not_needed";
      dueAt?: Date | null;
      remindedAt?: Date | null;
      offerSentAt?: Date | null;
      offerEndsAt?: Date | null;
    };

    async function makeOffer(s: Scenario, setup: OfferSetup) {
      const created = await owner.transaction((tx) =>
        offers.create(tx, {
          lotId: s.lotId,
          buyerDefaultId: s.defaultId,
          sequence: 1,
          offeredUserId: bidderId,
          offeredLegalEntityId: bidderEntity,
          sourceBidId: s.sourceBidId,
          amountPence: 90_000,
          status: "awaiting_seller",
          sellerLegalEntityId: sellerEntity,
          consent: {
            status: "requested",
            channel: null,
            terms,
            requestedAt: ASKED,
            dueAt: setup.dueAt === undefined ? DUE : setup.dueAt,
          },
          createdBy: staffId,
        }),
      );
      await owner
        .update(sellerConsent)
        .set({
          status: setup.consentStatus ?? "requested",
          remindedAt: setup.remindedAt ?? null,
          ...(setup.consentStatus === "given"
            ? { channel: "workspace", answeredAt: ASKED, answeredByUserId: sellerUserId }
            : {}),
        })
        .where(eq(sellerConsent.id, created.consentId));
      await owner
        .update(lotReoffer)
        .set({
          status: setup.status,
          offerSentAt: setup.offerSentAt === undefined ? null : setup.offerSentAt,
          offerEndsAt: setup.offerEndsAt === undefined ? null : setup.offerEndsAt,
          ...(setup.status === "accepted" ? { respondedAt: at("2026-11-03T10:00:00Z") } : {}),
        })
        .where(eq(lotReoffer.id, created.id));
      return { ...created, ref: { reofferId: created.id, lotId: s.lotId } };
    }

    const out = (setup: Partial<OfferSetup> = {}): OfferSetup => ({
      status: "offered",
      consentStatus: "given",
      offerSentAt: SENT,
      offerEndsAt: ENDS,
      ...setup,
    });

    const offerRow = async (id: string) =>
      (await owner.select().from(lotReoffer).where(eq(lotReoffer.id, id)))[0];
    const consentRow = async (id: string) =>
      (await owner.select().from(sellerConsent).where(eq(sellerConsent.id, id)))[0];
    const lotRow = async (id: string) => (await owner.select().from(lot).where(eq(lot.id, id)))[0];
    const eventsFor = async (lotId: string, type: string) =>
      owner
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateType, "lot"),
            eq(domainEvent.aggregateId, lotId),
            eq(domainEvent.eventType, type),
          ),
        );
    const noticesFor = async (reofferId: string) =>
      owner
        .select({ key: notificationOutbox.idempotencyKey, payload: notificationOutbox.payload })
        .from(notificationOutbox)
        .where(like(notificationOutbox.idempotencyKey, `%:${reofferId}:%`));
    const noticeTypes = async (reofferId: string) =>
      (await noticesFor(reofferId)).map((row) => (row.payload as { type: string }).type).sort();

    beforeAll(async () => {
      for (const id of [staffId, defaulterId, bidderId, sellerUserId]) {
        await owner.insert(user).values({
          id,
          name: id,
          email: `${id}@integration.test`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await owner
          .insert(bidIdentityDirectory)
          .values({
            subjectId: id,
            email: `${id}@integration.test`,
            name: id,
            identityCreatedAt: new Date(),
          })
          .onConflictDoNothing();
      }
      for (const [id, createdBy] of [
        [defaulterEntity, defaulterId],
        [bidderEntity, bidderId],
        [sellerEntity, sellerUserId],
      ] as const) {
        await owner.insert(legalEntity).values({
          id,
          displayName: `Entity ${id.slice(0, 4)}`,
          kind: "individual",
          subkind: "private_collector",
          createdByUserId: createdBy,
          status: "approved",
        });
      }
    });

    afterAll(async () => {
      const offerIds = (
        await owner
          .select({ id: lotReoffer.id })
          .from(lotReoffer)
          .where(inArray(lotReoffer.lotId, lotIds))
      ).map((row) => row.id);
      for (const id of offerIds) {
        await owner
          .delete(notificationOutbox)
          .where(like(notificationOutbox.idempotencyKey, `%:${id}:%`));
      }
      await owner.delete(domainEvent).where(inArray(domainEvent.aggregateId, lotIds));
      await owner.delete(lotLifecycleSnapshot).where(inArray(lotLifecycleSnapshot.lotId, lotIds));
      await owner.delete(lotReoffer).where(inArray(lotReoffer.lotId, lotIds));
      await owner.delete(sellerConsent).where(inArray(sellerConsent.lotId, lotIds));
      await owner.delete(buyerDefault).where(inArray(buyerDefault.lotId, lotIds));
      await owner.delete(lotFulfilment).where(inArray(lotFulfilment.lotId, lotIds));
      await owner.delete(payment).where(inArray(payment.lotId, lotIds));
      await owner.delete(bid).where(inArray(bid.lotId, lotIds));
      await owner.delete(lot).where(inArray(lot.id, lotIds));
      const entities = [defaulterEntity, bidderEntity, sellerEntity];
      await owner.delete(legalEntity).where(inArray(legalEntity.id, entities));
      const users = [staffId, defaulterId, bidderId, sellerUserId];
      await owner
        .delete(bidIdentityDirectory)
        .where(inArray(bidIdentityDirectory.subjectId, users));
      await owner.delete(user).where(inArray(user.id, users));
      await closeDb(owner);
      await closeDb(workerDb);
    });

    describe("seller requests", () => {
      it("waits before the reminder time and touches nothing", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, { status: "awaiting_seller" });
        currentNow = BEFORE_REMINDER;
        expect(await clock.settleSellerRequest(o.ref)).toBe("waiting");
        expect((await consentRow(o.consentId))?.remindedAt).toBeNull();
        expect(await noticesFor(o.id)).toHaveLength(0);
      });

      it("sends the seller's one reminder, in one step with its notice, and never a second", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, { status: "awaiting_seller" });
        currentNow = IN_LAST_DAY;
        expect(currentNow.getTime()).toBeGreaterThan(REMIND_AT.getTime());
        expect(await clock.settleSellerRequest(o.ref)).toBe("reminded");
        expect((await consentRow(o.consentId))?.remindedAt).toEqual(IN_LAST_DAY);
        expect(await noticeTypes(o.id)).toEqual(["reoffer_seller_reminder"]);
        const [row] = await noticesFor(o.id);
        expect(row?.payload).toMatchObject({
          title: expect.stringContaining("Your answer is needed by Thu 5 Nov, 17:00 GMT"),
          legalEntityId: sellerEntity,
        });

        currentNow = at("2026-11-04T19:00:00Z");
        expect(await clock.settleSellerRequest(o.ref)).toBe("waiting");
        expect(await noticesFor(o.id)).toHaveLength(1);
      });

      it("lapses an unanswered request at its deadline: status, who, when and a journal entry", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, { status: "awaiting_seller" });
        currentNow = DUE;
        expect(await clock.settleSellerRequest(o.ref)).toBe("lapsed");

        expect(await consentRow(o.consentId)).toMatchObject({
          status: "lapsed",
          channel: null,
          answeredByUserId: null,
          answeredAt: DUE,
        });
        expect(await offerRow(o.id)).toMatchObject({
          status: "seller_lapsed",
          closeReason: "seller_lapsed",
          closedBy: null,
          offerSentAt: null,
        });
        const events = await eventsFor(s.lotId, "lot.seller_consent_lapsed");
        expect(events).toHaveLength(1);
        expect(events[0]?.payload).toMatchObject({
          reofferId: o.id,
          buyerDefaultId: s.defaultId,
          sequence: 1,
          actor: "clock",
          amountPence: 90_000,
        });
        expect(events[0]?.producer).toBe("apps/worker");
        const [snapshot] = await owner
          .select()
          .from(lotLifecycleSnapshot)
          .where(eq(lotLifecycleSnapshot.lotId, s.lotId));
        expect(snapshot).toMatchObject({
          currentStatus: "ended",
          lastEventType: "lot.seller_consent_lapsed",
        });
        // The lot itself is untouched: no buyer, still ended.
        expect(await lotRow(s.lotId)).toMatchObject({ status: "ended", winnerId: null });
      });

      it("lapses a request whose reminder never went, and one that was reminded", async () => {
        const s1 = await defaultedLot();
        const never = await makeOffer(s1, { status: "awaiting_seller" });
        const s2 = await defaultedLot();
        const reminded = await makeOffer(s2, {
          status: "awaiting_seller",
          remindedAt: REMIND_AT,
        });
        currentNow = at("2026-11-09T09:00:00Z");
        expect(await clock.settleSellerRequest(never.ref)).toBe("lapsed");
        expect(await clock.settleSellerRequest(reminded.ref)).toBe("lapsed");
      });

      it("is a no-op the second time, and leaves a given or withdrawn request alone", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, { status: "awaiting_seller" });
        currentNow = AFTER_END;
        expect(await clock.settleSellerRequest(o.ref)).toBe("lapsed");
        expect(await clock.settleSellerRequest(o.ref)).toBe("waiting");
        expect(await eventsFor(s.lotId, "lot.seller_consent_lapsed")).toHaveLength(1);

        const s2 = await defaultedLot();
        const given = await makeOffer(s2, { status: "ready", consentStatus: "given" });
        expect(await clock.settleSellerRequest(given.ref)).toBe("waiting");
        expect((await offerRow(given.id))?.status).toBe("ready");
      });

      it("skips an offer that no longer exists", async () => {
        const s = await defaultedLot();
        expect(await clock.settleSellerRequest({ reofferId: randomUUID(), lotId: s.lotId })).toBe(
          "skipped",
        );
      });
    });

    describe("offers that are out", () => {
      it("is quiet until the last day, then reminds the bidder once", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, out());
        currentNow = BEFORE_REMINDER;
        expect(await clock.settleOffer(o.ref)).toBe("waiting");
        expect(await noticesFor(o.id)).toHaveLength(0);

        currentNow = IN_LAST_DAY;
        expect(await clock.settleOffer(o.ref)).toBe("reminded");
        expect(await noticeTypes(o.id)).toEqual(["reoffer_offer_reminder"]);
        const [row] = await noticesFor(o.id);
        expect(row?.payload).toMatchObject({
          title: expect.stringContaining("ends tomorrow"),
          message: expect.stringContaining("£900.00"),
          legalEntityId: bidderEntity,
        });

        // The reminder is keyed to the offer and the person: a later sweep adds nothing.
        currentNow = at("2026-11-05T09:00:00Z");
        expect(await clock.settleOffer(o.ref)).toBe("reminded");
        expect(await noticesFor(o.id)).toHaveLength(1);
        expect((await offerRow(o.id))?.status).toBe("offered");
      });

      it("ends the offer at its end time and tells the bidder, and the seller who agreed", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, out());
        currentNow = ENDS;
        expect(await clock.settleOffer(o.ref)).toBe("ended");

        expect(await offerRow(o.id)).toMatchObject({
          status: "expired",
          closeReason: "offer_ended",
          closedBy: null,
          reawardedAt: null,
          respondedAt: null,
          amountPence: 90_000,
        });
        expect(await noticeTypes(o.id)).toEqual(["reoffer_offer_closed", "reoffer_seller_outcome"]);
        const events = await eventsFor(s.lotId, "lot.reoffer_expired");
        expect(events).toHaveLength(1);
        expect(events[0]?.payload).toMatchObject({ reofferId: o.id, actor: "clock" });
        // The lot is untouched: no buyer, no payment raised, fulfilment unchanged.
        expect(await lotRow(s.lotId)).toMatchObject({ status: "ended", winnerId: null });
        expect(await owner.select().from(payment).where(eq(payment.lotId, s.lotId))).toHaveLength(
          0,
        );

        expect(await clock.settleOffer(o.ref)).toBe("waiting");
        expect(await eventsFor(s.lotId, "lot.reoffer_expired")).toHaveLength(1);
        expect(await noticesFor(o.id)).toHaveLength(2);
      });

      it("tells only the bidder when the seller never had to agree", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, out({ consentStatus: "not_needed" }));
        currentNow = AFTER_END;
        expect(await clock.settleOffer(o.ref)).toBe("ended");
        expect(await noticeTypes(o.id)).toEqual(["reoffer_offer_closed"]);
      });

      it("never ends an offer that was accepted, declined or withdrawn", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, out({ status: "accepted" }));
        currentNow = AFTER_END;
        expect(await clock.settleOffer(o.ref)).toBe("waiting");
        expect((await offerRow(o.id))?.status).toBe("accepted");
        expect(await eventsFor(s.lotId, "lot.reoffer_expired")).toHaveLength(0);
      });

      it("does not remind about an offer that can no longer be won, but still ends it", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, out());
        // A payment on the lot that is being paid: accepting would be refused.
        await owner.insert(payment).values({
          lotId: s.lotId,
          buyerId: bidderId,
          buyerLegalEntityId: bidderEntity,
          sellerLegalEntityId: sellerEntity,
          amount: "1080.00",
          platformFee: "90.00",
          status: "authorized",
        });
        currentNow = IN_LAST_DAY;
        expect(await clock.settleOffer(o.ref)).toBe("waiting");
        expect(await noticesFor(o.id)).toHaveLength(0);

        currentNow = AFTER_END;
        expect(await clock.settleOffer(o.ref)).toBe("ended");
        // The payment is untouched.
        const [pay] = await owner.select().from(payment).where(eq(payment.lotId, s.lotId));
        expect(pay?.status).toBe("authorized");
      });

      it("an expired offer can never be re-awarded afterwards", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, out());
        currentNow = AFTER_END;
        await clock.settleOffer(o.ref);
        const refused = await owner
          .transaction((tx) => reaward.reaward(tx, { reofferId: o.id }))
          .then(
            () => null,
            (error: unknown) => error,
          );
        expect(refused).toBeInstanceOf(LotReawardRefusedError);
        expect(await lotRow(s.lotId)).toMatchObject({ winnerId: null });
      });
    });

    describe("races", () => {
      it("two clocks on one offer end it once", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, out());
        currentNow = AFTER_END;
        const results = await Promise.all([clock.settleOffer(o.ref), clock.settleOffer(o.ref)]);
        expect(results.filter((r) => r === "ended")).toHaveLength(1);
        expect(results.filter((r) => r !== "ended")).toHaveLength(1);
        expect(await eventsFor(s.lotId, "lot.reoffer_expired")).toHaveLength(1);
        expect(await noticesFor(o.id)).toHaveLength(2);
      });

      it("two clocks on one request lapse it once", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, { status: "awaiting_seller" });
        currentNow = AFTER_END;
        const results = await Promise.all([
          clock.settleSellerRequest(o.ref),
          clock.settleSellerRequest(o.ref),
        ]);
        expect(results.filter((r) => r === "lapsed")).toHaveLength(1);
        expect(await eventsFor(s.lotId, "lot.seller_consent_lapsed")).toHaveLength(1);
      });

      it("waits for an accept that holds the lot's lock, then leaves the accepted offer alone", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, out());
        currentNow = AFTER_END;

        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let locked: () => void = () => {};
        const holding = new Promise<void>((resolve) => {
          locked = resolve;
        });
        // The accept, as the API runs it: lot lock, offer lock, accept, re-award; commit is slow.
        const accept = owner.transaction(async (tx) => {
          const lockedLot = await workflow.lockLot(tx, s.lotId);
          expect(lockedLot).not.toBeNull();
          await workflow.lockOffer(tx, o.id);
          await offers.changeStatus(tx, {
            id: o.id,
            from: "offered",
            to: "accepted",
            respondedAt: at("2026-11-05T16:59:00Z"),
          });
          await reaward.reaward(tx, { reofferId: o.id });
          locked();
          await gate;
        });
        await holding;

        const settled = vi.fn();
        const clockStep = clock.settleOffer(o.ref).then((outcome) => {
          settled(outcome);
          return outcome;
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(settled).not.toHaveBeenCalled();

        release();
        await accept;
        expect(await clockStep).toBe("waiting");
        expect((await offerRow(o.id))?.status).toBe("accepted");
        expect(await lotRow(s.lotId)).toMatchObject({ winnerId: bidderId });
        expect(await eventsFor(s.lotId, "lot.reoffer_expired")).toHaveLength(0);
        expect(await noticesFor(o.id)).toHaveLength(0);
      });

      it("takes locks in the API's order: clock steps and accept-style transactions do not deadlock", async () => {
        const scenarios = await Promise.all(Array.from({ length: 4 }, () => defaultedLot()));
        const made = await Promise.all(scenarios.map((s) => makeOffer(s, out())));
        currentNow = AFTER_END;
        const results = await Promise.allSettled(
          made.flatMap((o, index) => [
            clock.settleOffer(o.ref),
            // The same lock sequence the API's answers use (lot, then offer), holding briefly.
            owner.transaction(async (tx) => {
              await workflow.lockLot(tx, scenarios[index]?.lotId as string);
              await workflow.lockOffer(tx, o.id);
              await new Promise((resolve) => setTimeout(resolve, 20));
            }),
          ]),
        );
        expect(results.filter((r) => r.status === "rejected")).toEqual([]);
        for (const o of made) expect((await offerRow(o.id))?.status).toBe("expired");
      });
    });

    describe("the sweep", () => {
      it("settles everything that is due, counts it, and one failure does not stop the rest", async () => {
        const s1 = await defaultedLot();
        const lapsing = await makeOffer(s1, { status: "awaiting_seller" });
        const s2 = await defaultedLot();
        const ending = await makeOffer(s2, out());
        currentNow = AFTER_END;
        const real = clock.settleOffer.bind(clock);
        const flaky = {
          settleSellerRequest: clock.settleSellerRequest.bind(clock),
          settleOffer: async (ref: { reofferId: string; lotId: string }) => {
            if (ref.reofferId === ending.id) throw new Error("boom");
            return real(ref);
          },
        };
        const result = await runReofferSweepJob({
          reader,
          clock: flaky,
          marker,
          ensureInvoice: null,
          log,
          now: () => currentNow,
        });
        expect(result.failed).toBeGreaterThanOrEqual(1);
        expect((await offerRow(lapsing.id))?.status).toBe("seller_lapsed");
        // The failed one is still out and is picked up next time.
        expect((await offerRow(ending.id))?.status).toBe("offered");
        const again = await runReofferSweepJob({
          reader,
          clock,
          marker,
          ensureInvoice: null,
          log,
          now: () => currentNow,
        });
        expect(again.ended).toBeGreaterThanOrEqual(1);
        expect((await offerRow(ending.id))?.status).toBe("expired");
      });
    });

    describe("an accepted offer whose invoice was missed", () => {
      const sweepReader = new DrizzleReofferSweepReader(workerDb);

      /** An accepted offer, re-awarded for real so the lot, bids and fulfilment are as production's. */
      async function reawarded() {
        const s = await defaultedLot();
        const o = await makeOffer(s, out({ status: "accepted" }));
        await owner.transaction((tx) => reaward.reaward(tx, { reofferId: o.id }));
        return { s, o };
      }
      const listed = async (reawardedBefore: Date) =>
        (await sweepReader.acceptedWithoutInvoice({ reawardedBefore, limit: 500 })).map(
          (ref) => ref.reofferId,
        );
      const later = () => new Date(Date.now() + 60_000);

      it("lists it, once the award is older than the grace period, and raises the invoice", async () => {
        const { o } = await reawarded();
        expect(await listed(new Date(Date.now() - 3_600_000))).not.toContain(o.id);
        expect(await listed(later())).toContain(o.id);

        const ensureInvoice = vi.fn(async () => ({ created: true }));
        const result = await runReofferSweepJob({
          reader: sweepReader,
          clock: {
            settleSellerRequest: async () => "waiting" as const,
            settleOffer: async () => "waiting" as const,
          },
          marker,
          ensureInvoice,
          log,
          now: () => new Date(Date.now() + 3_600_000),
        });
        expect(ensureInvoice).toHaveBeenCalledWith(o.ref.lotId);
        expect(result.invoicesRaised).toBeGreaterThanOrEqual(1);
      });

      it("does not list it once the buyer has an invoice", async () => {
        const { s, o } = await reawarded();
        await owner.insert(payment).values({
          lotId: s.lotId,
          buyerId: bidderId,
          buyerLegalEntityId: bidderEntity,
          sellerLegalEntityId: sellerEntity,
          amount: "972.00",
          platformFee: "90.00",
          status: "pending",
        });
        expect(await listed(later())).not.toContain(o.id);
      });

      it("does not list it after a later default took the lot back", async () => {
        const { s, o } = await reawarded();
        await owner
          .update(lot)
          .set({ winnerId: null, buyerLegalEntityId: null })
          .where(eq(lot.id, s.lotId));
        expect(await listed(later())).not.toContain(o.id);
        await owner.update(lot).set({ winnerId: bidderId }).where(eq(lot.id, s.lotId));
        await owner.insert(buyerDefault).values({
          lotId: s.lotId,
          buyerId: bidderId,
          buyerLegalEntityId: bidderEntity,
          sellerLegalEntityId: sellerEntity,
          hammerPrice: "900.00",
          wonAt: new Date(),
          reason: "No payment",
          outcome: "returned_to_inventory",
          actorUserId: staffId,
          createdAt: new Date(Date.now() + 5_000),
        });
        expect(await listed(later())).not.toContain(o.id);
      });

      it("does not list a soft-deleted lot", async () => {
        const { s, o } = await reawarded();
        expect(await listed(later())).toContain(o.id);
        await owner.update(lot).set({ deletedAt: new Date() }).where(eq(lot.id, s.lotId));
        expect(await listed(later())).not.toContain(o.id);
      });

      it("pins the lot's buyer account to the offer's", async () => {
        const { s, o } = await reawarded();
        await owner
          .update(lot)
          .set({ buyerLegalEntityId: defaulterEntity })
          .where(eq(lot.id, s.lotId));
        expect(await listed(later())).not.toContain(o.id);
        await owner
          .update(lot)
          .set({ buyerLegalEntityId: bidderEntity })
          .where(eq(lot.id, s.lotId));
        expect(await listed(later())).toContain(o.id);
      });

      const paymentOf = (
        lotId: string,
        status: "cancelled" | "authorized",
        entity = bidderEntity,
      ) =>
        owner.insert(payment).values({
          lotId,
          buyerId: bidderId,
          buyerLegalEntityId: entity,
          sellerLegalEntityId: sellerEntity,
          amount: "972.00",
          platformFee: "90.00",
          status,
        });

      it("counts only live payments: a cancelled one hides nothing", async () => {
        const { s, o } = await reawarded();
        await paymentOf(s.lotId, "cancelled");
        await paymentOf(s.lotId, "cancelled");
        expect(await listed(later())).toContain(o.id);
        await paymentOf(s.lotId, "authorized");
        expect(await listed(later())).not.toContain(o.id);
      });

      it("ignores a live payment of another account on the lot", async () => {
        const { s, o } = await reawarded();
        await paymentOf(s.lotId, "authorized", defaulterEntity);
        expect(await listed(later())).toContain(o.id);
      });

      describe.each([
        ["lot_not_found"],
        ["payment_amount_exceeds_limit"],
        ["invalid_payment_amount"],
        ["missing_seller_legal_entity"],
        ["no_winner"],
        ["lot_not_ended"],
        ["missing_buyer_legal_entity"],
        ["payment_already_exists"],
        ["already_refunded"],
        ["lot_moved"],
      ])("when ensureForLot answers %s", (reason) => {
        it("counts it, marks it, and lists the row only once", async () => {
          const { o } = await reawarded();
          const ensureInvoice = vi.fn(async () => ({ created: false, reason }));
          const sweep = () =>
            runReofferSweepJob({
              reader: sweepReader,
              clock: {
                settleSellerRequest: async () => "waiting" as const,
                settleOffer: async () => "waiting" as const,
              },
              marker,
              ensureInvoice,
              log,
              now: () => new Date(Date.now() + 3_600_000),
            });
          const first = await sweep();
          expect(first.invoicesUnraised).toBeGreaterThanOrEqual(1);
          expect(first.failed).toBe(0);
          expect((await offerRow(o.id))?.closeReason).toBe(`invoice_not_raised:${reason}`);
          expect((await offerRow(o.id))?.status).toBe("accepted");
          expect(await listed(later())).not.toContain(o.id);
          ensureInvoice.mockClear();
          await sweep();
          expect(ensureInvoice).not.toHaveBeenCalledWith(o.ref.lotId);
        });
      });

      it("marks an offer once, only while accepted", async () => {
        const { o } = await reawarded();
        expect(await marker.markInvoiceNotRaised(o.id, "invoice_not_raised:x")).toBe(true);
        expect(await marker.markInvoiceNotRaised(o.id, "invoice_not_raised:y")).toBe(false);
        expect((await offerRow(o.id))?.closeReason).toBe("invoice_not_raised:x");
      });

      it("never lists an offer that was not accepted", async () => {
        const s = await defaultedLot();
        const o = await makeOffer(s, out());
        expect(await listed(later())).not.toContain(o.id);
      });
    });
  },
);
