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
  saleSellerTerms,
  uploadObject,
  user,
} from "@auction/db/schema";
import {
  DrizzleSaleSellerTermsStore,
  DrizzleSignedAgreementWriter,
  DrizzleStaffLotSellerProceedsReader,
  DrizzleTransactionRunner,
  DrizzleUploadObjectReader,
} from "@auction/persistence/repositories";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DomainEventSink } from "../domain-event-sink.js";
import { DomainEventPublisher } from "../domain-event.publisher.js";
import { RecordSignedAgreementService } from "./record-signed-agreement.service.js";
import { SellerProceedsError } from "./seller-proceeds-errors.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Recording a signed agreement against a real database: the recorded row meets the table's
 * checks, the held sale is priced again by the calculator and leaves the held state, the audit
 * event is stored, and a sale that is not held keeps its figures. Rolled back.
 */
describe.skipIf(!HAS_DB)("recording a signed agreement (integration)", () => {
  it("records the agreement, releases the held sale and keeps the audit entry", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const staffId = `record-staff-${tag}`;
    const buyerId = `record-buyer-${tag}`;
    const seller = randomUUID();
    const buyer = randomUUID();
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        const conn = tx as unknown as Database;
        for (const id of [staffId, buyerId]) {
          await tx.insert(user).values({
            id,
            name: id,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          });
        }
        for (const [id, name] of [
          [seller, "Fixture Gallery Ltd"],
          [buyer, "Fixture Buyer"],
        ] as const) {
          await tx.insert(legalEntity).values({
            id,
            displayName: name,
            kind: "organisation",
            subkind: "gallery",
            primaryCountry: "GB",
            createdByUserId: staffId,
          } as typeof legalEntity.$inferInsert);
        }
        const lotId = randomUUID();
        await tx.insert(lot).values({
          id: lotId,
          title: `Record ${tag}`,
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
          buyerLegalEntityId: buyer,
        });
        const submissionId = randomUUID();
        await tx.insert(itemSubmission).values({
          id: submissionId,
          legalEntityId: seller,
          title: "Consigned work",
          convertedLotId: lotId,
        });
        const [invoice] = await tx
          .insert(bidInvoice)
          .values({
            lotId,
            buyerLegalEntityId: buyer,
            sellerLegalEntityId: seller,
            totalPence: 775_000,
            raisedAt: now,
            dueAt: new Date(Date.now() + 86_400_000),
          })
          .returning({ id: bidInvoice.id });
        if (!invoice) throw new Error("invoice not stored");
        await tx.insert(bidInvoiceLine).values([
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
        const [paid] = await tx
          .insert(payment)
          .values({
            lotId,
            buyerId,
            buyerLegalEntityId: buyer,
            sellerLegalEntityId: seller,
            amount: "7750.00",
            platformFee: "0.00",
            status: "captured",
            invoiceId: invoice.id,
          })
          .returning({ id: payment.id });
        if (!paid) throw new Error("payment not stored");
        const [held] = await tx
          .insert(saleSellerTerms)
          .values({
            paymentId: paid.id,
            lotId,
            sellerLegalEntityId: seller,
            hammerPence: 620_000,
            premiumPence: 155_000,
            ruleVersion: "agreement_hammer_v1",
            basis: "held",
            heldReason: "no_agreement",
          })
          .returning({ id: saleSellerTerms.id });
        if (!held) throw new Error("terms not stored");
        const [pdf] = await tx
          .insert(uploadObject)
          .values({
            ownerUserId: staffId,
            kind: "signed_consignment_agreement",
            key: `uploads/test/consignment-agreements/${tag}.pdf`,
            declaredContentType: "application/pdf",
            declaredByteSize: 120_000,
            actualContentType: "application/pdf",
            actualByteSize: 120_000,
            status: "active",
            expiresAt: new Date(Date.now() + 86_400_000),
          })
          .returning({ id: uploadObject.id });
        if (!pdf) throw new Error("upload not stored");

        const runner = new DrizzleTransactionRunner(conn);
        const sink = new DomainEventSink(new DomainEventPublisher(), conn);
        const reader = new DrizzleStaffLotSellerProceedsReader(conn);
        const service = new RecordSignedAgreementService({
          reader,
          uploads: new DrizzleUploadObjectReader(conn),
          today: () => "2026-11-13",
          unitOfWork: (work) =>
            runner.runInTransaction((inner) =>
              work({
                agreements: new DrizzleSignedAgreementWriter(inner),
                sellerTerms: new DrizzleSaleSellerTermsStore(inner as unknown as Database),
                events: sink.withTx(inner),
              }),
            ),
        });

        const command = {
          lotId,
          commissionPercent: "12",
          signedOn: "2026-10-03",
          uploadObjectId: pdf.id,
          reason: "Signed on paper at the gallery",
          replace: false,
          actor: { userId: staffId, isAdministrator: false },
        };
        const result = await service.record(command);
        expect(result).toMatchObject({ releasedSellerTermsId: held.id, sellerNetPence: 530_720 });

        const [agreement] = await tx
          .select()
          .from(consignmentAgreement)
          .where(eq(consignmentAgreement.submissionId, submissionId));
        expect(agreement).toMatchObject({
          source: "recorded",
          commissionPercent: "12.00",
          signedDocumentId: pdf.id,
          recordReason: "Signed on paper at the gallery",
          recordedByUserId: staffId,
          legalEntityId: seller,
        });

        const [terms] = await tx
          .select()
          .from(saleSellerTerms)
          .where(eq(saleSellerTerms.id, held.id));
        expect(terms).toMatchObject({
          basis: "agreement",
          source: "agreement_recorded",
          agreementId: agreement?.id,
          commissionBps: 1200,
          commissionPence: 74_400,
          commissionVatPence: 14_880,
          sellerNetPence: 530_720,
        });

        const events = await tx
          .select()
          .from(domainEvent)
          .where(
            and(
              eq(domainEvent.aggregateId, lotId),
              eq(domainEvent.eventType, "lot.seller_agreement_recorded"),
            ),
          );
        expect(events).toHaveLength(1);
        expect(events[0]?.actorUserId).toBe(staffId);

        // Recording again by accident is refused; the sale is no longer held either way.
        const again = await service.record(command).catch((e: unknown) => e);
        expect(again).toBeInstanceOf(SellerProceedsError);
        expect((again as SellerProceedsError).code).toBe("agreement_on_record");

        // An Administrator's correction updates the agreement, but a priced sale keeps its figures.
        await service.record({
          ...command,
          commissionPercent: "15",
          replace: true,
          actor: { userId: staffId, isAdministrator: true },
        });
        const [kept] = await tx
          .select()
          .from(saleSellerTerms)
          .where(eq(saleSellerTerms.id, held.id));
        expect(kept?.commissionBps).toBe(1200);
        const [corrected] = await tx
          .select()
          .from(consignmentAgreement)
          .where(eq(consignmentAgreement.submissionId, submissionId));
        expect(corrected?.commissionPercent).toBe("15.00");

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
