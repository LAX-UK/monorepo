import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  bidInvoice,
  bidInvoiceLine,
  consignmentAgreement,
  domainEvent,
  itemSubmission,
  legalEntity,
  lot,
  payment,
  payout,
  payoutLine,
  saleSellerTerms,
  uploadObject,
} from "@auction/db/schema";
import {
  type ISettlementSellerTerms,
  type PayoutSettlementDeps,
  createSettlement,
  payoutRepoForTx,
  settlementSellerTermsForTx,
} from "@auction/finance-runtime";
import type { ISignedAgreementWriter } from "@auction/persistence/interfaces";
import {
  DrizzlePayoutRepository,
  DrizzleSaleSellerTermsStore,
  DrizzleSignedAgreementWriter,
  DrizzleStaffLotSellerProceedsReader,
  DrizzleTransactionRunner,
  DrizzleUploadObjectReader,
} from "@auction/persistence/repositories";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { DomainEventSink } from "../domain-event-sink.js";
import { DomainEventPublisher } from "../domain-event.publisher.js";
import { RecordSignedAgreementService } from "./record-signed-agreement.service.js";
import { SellerProceedsError } from "./seller-proceeds-errors.js";

const url = process.env.DATABASE_URL;

/** A promise to hold one side of a race at a known point, and the hook that lets it go. */
function gate() {
  let open: () => void = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  let reach: () => void = () => {};
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  return { opened, open, reached, reach };
}

/** True when the promise has not settled within the given time: it is waiting on a lock. */
async function stillWaiting(promise: Promise<unknown>, ms = 400): Promise<boolean> {
  const marker = Symbol("waiting");
  const winner = await Promise.race([
    promise.then(
      () => null,
      () => null,
    ),
    new Promise((resolve) => setTimeout(() => resolve(marker), ms)),
  ]);
  return winner === marker;
}

/**
 * Recording an agreement while someone else acts on the same seller, on real, committed
 * transactions: two quick submissions of the same form, and a recording racing a payout run in
 * either order. Every row written is removed afterwards.
 */
describe.skipIf(!url)(
  "recording a signed agreement at the same time as others (Postgres)",
  {
    timeout: 60_000,
  },
  () => {
    const db = createDb(url as string);
    const tag = randomUUID().slice(0, 8);
    const staffId = `record-cc-staff-${tag}`;
    const buyerId = `record-cc-buyer-${tag}`;
    const buyerEntity = randomUUID();
    const sellers: string[] = [];
    const lotIds: string[] = [];
    const submissionIds: string[] = [];
    const uploadIds: string[] = [];
    const runner = new DrizzleTransactionRunner(db);
    const sink = new DomainEventSink(new DomainEventPublisher(), db);
    const repo = new DrizzlePayoutRepository(db);

    beforeAll(async () => {
      await seedIdentityUserFixtures(
        db,
        [staffId, buyerId].map((id) => ({ id, name: id, email: `${id}@integration.test` })),
      );
      await db.insert(legalEntity).values({
        id: buyerEntity,
        displayName: "Fixture Buyer",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: staffId,
        status: "approved",
      });
    });

    afterAll(async () => {
      const payouts = sellers.length
        ? await db
            .select({ id: payout.id })
            .from(payout)
            .where(inArray(payout.legalEntityId, sellers))
        : [];
      if (payouts.length) {
        const ids = payouts.map((p) => p.id);
        await db.delete(payoutLine).where(inArray(payoutLine.payoutId, ids));
        await db.delete(domainEvent).where(inArray(domainEvent.aggregateId, ids));
        await db.delete(payout).where(inArray(payout.id, ids));
      }
      if (lotIds.length) {
        await db.delete(domainEvent).where(inArray(domainEvent.aggregateId, lotIds));
        await db.delete(saleSellerTerms).where(inArray(saleSellerTerms.lotId, lotIds));
        await db.delete(payment).where(inArray(payment.lotId, lotIds));
        await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, lotIds));
      }
      if (submissionIds.length) {
        await db
          .delete(consignmentAgreement)
          .where(inArray(consignmentAgreement.submissionId, submissionIds));
        await db.delete(itemSubmission).where(inArray(itemSubmission.id, submissionIds));
      }
      if (uploadIds.length)
        await db.delete(uploadObject).where(inArray(uploadObject.id, uploadIds));
      if (lotIds.length) await db.delete(lot).where(inArray(lot.id, lotIds));
      await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerEntity, ...sellers]));
      await deleteIdentityUserFixtures(db, [staffId, buyerId]);
    });

    async function newSeller(): Promise<string> {
      const id = randomUUID();
      sellers.push(id);
      await db.insert(legalEntity).values({
        id,
        displayName: `Fixture Gallery ${id.slice(0, 4)}`,
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: staffId,
        status: "approved",
      });
      return id;
    }

    /** A captured sale for the seller: held with no agreement, or priced on one at 15%. */
    async function seedSale(seller: string, kind: "held" | "priced") {
      const lotId = randomUUID();
      lotIds.push(lotId);
      await db.insert(lot).values({
        id: lotId,
        title: `Race ${lotId.slice(0, 6)}`,
        images: [],
        auctionType: "english",
        startingPrice: "100.00",
        currentPrice: "6200.00",
        minBidIncrement: "10.00",
        startTime: new Date(Date.now() - 10 * 86_400_000),
        endTime: new Date(Date.now() - 2 * 86_400_000),
        status: "ended",
        sellerLegalEntityId: seller,
        winnerId: buyerId,
        buyerLegalEntityId: buyerEntity,
      });
      const submissionId = randomUUID();
      submissionIds.push(submissionId);
      await db.insert(itemSubmission).values({
        id: submissionId,
        legalEntityId: seller,
        title: "Consigned work",
        convertedLotId: lotId,
      });
      let agreementId: string | null = null;
      if (kind === "priced") {
        const [agreement] = await db
          .insert(consignmentAgreement)
          .values({
            submissionId,
            legalEntityId: seller,
            termsVersion: "v1",
            commissionPercent: "15.00",
            acceptedAt: new Date("2026-10-01T10:00:00Z"),
          })
          .returning({ id: consignmentAgreement.id });
        agreementId = agreement?.id ?? null;
      }
      const [invoice] = await db
        .insert(bidInvoice)
        .values({
          lotId,
          buyerLegalEntityId: buyerEntity,
          sellerLegalEntityId: seller,
          totalPence: 775_000,
          raisedAt: new Date(),
          dueAt: new Date(Date.now() + 86_400_000),
        })
        .returning({ id: bidInvoice.id });
      if (!invoice) throw new Error("invoice not stored");
      await db.insert(bidInvoiceLine).values([
        {
          invoiceId: invoice.id,
          position: 1,
          kind: "hammer",
          label: "Hammer",
          amountPence: 620_000,
        },
        {
          invoiceId: invoice.id,
          position: 2,
          kind: "buyers_premium",
          label: "Buyer's premium",
          ratePercent: "25.000",
          amountPence: 155_000,
        },
      ]);
      const [paid] = await db
        .insert(payment)
        .values({
          lotId,
          buyerId,
          buyerLegalEntityId: buyerEntity,
          sellerLegalEntityId: seller,
          amount: "7750.00",
          platformFee: "0.00",
          status: "captured",
          invoiceId: invoice.id,
        })
        .returning({ id: payment.id });
      if (!paid) throw new Error("payment not stored");
      const base = {
        paymentId: paid.id,
        lotId,
        sellerLegalEntityId: seller,
        hammerPence: 620_000,
        premiumPence: 155_000,
        ruleVersion: "agreement_hammer_v1",
      };
      const [terms] = await db
        .insert(saleSellerTerms)
        .values(
          kind === "held"
            ? { ...base, basis: "held", heldReason: "no_agreement" }
            : {
                ...base,
                basis: "agreement",
                agreementId,
                commissionBps: 1500,
                commissionPence: 93_000,
                commissionVatTreatment: "standard",
                commissionVatBps: 2000,
                commissionVatPence: 18_600,
                sellerNetPence: 508_400,
              },
        )
        .returning({ id: saleSellerTerms.id });
      if (!terms) throw new Error("terms not stored");
      return { lotId, submissionId, paymentId: paid.id, termsId: terms.id };
    }

    async function signedPdf(): Promise<string> {
      const [row] = await db
        .insert(uploadObject)
        .values({
          ownerUserId: staffId,
          kind: "signed_consignment_agreement",
          key: `uploads/test/consignment-agreements/${randomUUID()}.pdf`,
          declaredContentType: "application/pdf",
          declaredByteSize: 120_000,
          actualContentType: "application/pdf",
          actualByteSize: 120_000,
          status: "active",
          expiresAt: new Date(Date.now() + 86_400_000),
        })
        .returning({ id: uploadObject.id });
      if (!row) throw new Error("upload not stored");
      uploadIds.push(row.id);
      return row.id;
    }

    /** The service on real transactions; `wrap` can hold the writer at a chosen step. */
    function serviceWith(wrap: (w: ISignedAgreementWriter) => ISignedAgreementWriter = (w) => w) {
      return new RecordSignedAgreementService({
        reader: new DrizzleStaffLotSellerProceedsReader(db),
        uploads: new DrizzleUploadObjectReader(db),
        today: () => "2026-11-13",
        unitOfWork: (work) =>
          runner.runInTransaction((tx) =>
            work({
              facts: new DrizzleStaffLotSellerProceedsReader(tx as unknown as Database),
              agreements: wrap(new DrizzleSignedAgreementWriter(tx)),
              sellerTerms: new DrizzleSaleSellerTermsStore(tx as unknown as Database),
              events: sink.withTx(tx),
            }),
          ),
      });
    }

    function runDeps(sellerTermsForTx = settlementSellerTermsForTx): PayoutSettlementDeps {
      return {
        repo,
        transactionRunner: runner,
        domainEventSink: { withTx: () => ({ publish: async () => {} }) },
        payoutAdjustments: undefined,
        payoutRepoForTx: (tx) => payoutRepoForTx(repo, tx),
        sellerTermsForTx,
      };
    }

    const command = (lotId: string, uploadObjectId: string) => ({
      lotId,
      commissionPercent: "12",
      signedOn: "2026-10-03",
      uploadObjectId,
      reason: "Signed on paper at the gallery",
      replace: false,
      actor: { userId: staffId, isAdministrator: false },
    });

    const recordedEvents = (lotId: string) =>
      db
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateId, lotId),
            eq(domainEvent.eventType, "lot.seller_agreement_recorded"),
          ),
        );

    it("two quick submissions by a non-Administrator: one records, the other is refused with 409", async () => {
      const seller = await newSeller();
      const sale = await seedSale(seller, "held");
      const pdf = await signedPdf();
      const service = serviceWith();

      const results = await Promise.allSettled([
        service.record(command(sale.lotId, pdf)),
        service.record({ ...command(sale.lotId, pdf), commissionPercent: "14" }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const error = (rejected[0] as PromiseRejectedResult).reason;
      expect(error).toBeInstanceOf(SellerProceedsError);
      expect((error as SellerProceedsError).status).toBe(409);
      expect((error as SellerProceedsError).code).toBe("agreement_on_record");

      const agreements = await db
        .select()
        .from(consignmentAgreement)
        .where(eq(consignmentAgreement.submissionId, sale.submissionId));
      expect(agreements).toHaveLength(1);
      expect(await recordedEvents(sale.lotId)).toHaveLength(1);
    });

    it("a run already holding the seller's lock goes first; the recording waits, then releases the sale into the next payout", async () => {
      const seller = await newSeller();
      const ready = await seedSale(seller, "priced");
      const held = await seedSale(seller, "held");
      const pdf = await signedPdf();
      const hold = gate();
      const gated = (tx: Database): ISettlementSellerTerms => {
        const inner = settlementSellerTermsForTx(tx);
        return {
          forPreview: (p, e) => inner.forPreview(p, e),
          forRun: async (p, e) => {
            hold.reach();
            await hold.opened;
            return inner.forRun(p, e);
          },
        };
      };
      const run = createSettlement(runDeps(gated), staffId, {
        legalEntityId: seller,
        periodEnd: new Date(),
        reason: "Race test run",
      });
      await hold.reached;
      const recording = serviceWith().record(command(held.lotId, pdf));
      expect(await stillWaiting(recording)).toBe(true);
      hold.open();

      const settled = await run;
      const result = await recording;
      expect(settled.ok).toBe(true);
      const paid = settled.ok ? settled.payout.lines.map((l) => l.paymentId) : [];
      expect(paid).toEqual([ready.paymentId]);
      expect(result.sale).toEqual({
        kind: "released",
        sellerTermsId: held.termsId,
        sellerNetPence: 530_720,
      });
      const [event] = await recordedEvents(held.lotId);
      expect(event?.payload).toMatchObject({ saleOutcome: "released", sellerNetPence: 530_720 });
    });

    it("a recording holding the seller's lock goes first; the run waits, then pays the released sale with the rest", async () => {
      const seller = await newSeller();
      const ready = await seedSale(seller, "priced");
      const held = await seedSale(seller, "held");
      const pdf = await signedPdf();
      const hold = gate();
      const recording = serviceWith((writer) => ({
        lockSettlement: (id) => writer.lockSettlement(id),
        lockSale: async (sale) => {
          await writer.lockSale(sale);
          hold.reach();
          await hold.opened;
        },
        lockAgreement: (id) => writer.lockAgreement(id),
        claimDocument: (u, s) => writer.claimDocument(u, s),
        recordSigned: (input) => writer.recordSigned(input),
      })).record(command(held.lotId, pdf));
      await hold.reached;
      const run = createSettlement(runDeps(), staffId, {
        legalEntityId: seller,
        periodEnd: new Date(),
        reason: "Race test run",
      });
      expect(await stillWaiting(run)).toBe(true);
      hold.open();

      const result = await recording;
      const settled = await run;
      expect(result.sale.kind).toBe("released");
      expect(settled.ok).toBe(true);
      const paid = settled.ok ? settled.payout.lines.map((l) => l.paymentId).sort() : [];
      expect(paid).toEqual([ready.paymentId, held.paymentId].sort());
    });

    it("refuses to attach one signed PDF to a second consignment", async () => {
      const seller = await newSeller();
      const first = await seedSale(seller, "held");
      const second = await seedSale(seller, "held");
      const pdf = await signedPdf();
      const service = serviceWith();
      await service.record(command(first.lotId, pdf));
      const error = await service.record(command(second.lotId, pdf)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SellerProceedsError);
      expect((error as SellerProceedsError).fields.document).toMatch(/already recorded/);
      const [stillHeld] = await db
        .select({ basis: saleSellerTerms.basis })
        .from(saleSellerTerms)
        .where(eq(saleSellerTerms.id, second.termsId));
      expect(stillHeld?.basis).toBe("held");
    });
  },
);
