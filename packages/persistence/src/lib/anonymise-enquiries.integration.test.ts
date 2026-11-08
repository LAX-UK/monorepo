import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  bidUserProfile,
  domainEvent,
  itemSubmission,
  kycWatchlistScreening,
  legalEntity,
  marketingEnquiry,
  marketingEnquiryAttachment,
  marketingEnquiryNote,
  privateSaleDeal,
  privateSaleDealStageHistory,
  sourceOfFunds,
  uploadObject,
  user,
} from "@auction/db/schema";
import { ERASED_ENQUIRY } from "@auction/domain";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzlePrivateSaleDealRepository } from "../repositories/drizzle-private-sale-deal.repository.js";
import { anonymiseEnquiries } from "./anonymise-enquiries.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("enquiry erasure (integration)", () => {
  it("anonymises by email, detaches and expires files, holds converted, and is idempotent", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const email = `erase-${randomUUID().slice(0, 8)}@example.com`;
    const future = new Date(Date.now() + 3_600_000);

    try {
      await db.transaction(async (tx) => {
        const base = {
          topic: "selling",
          name: "Ada Lovelace",
          email: email.toUpperCase(),
          phone: "+447000000000",
          message: "I have a painting to sell",
          intent: "general",
          departmentSlug: "modern",
        };
        const [open] = await tx
          .insert(marketingEnquiry)
          .values(base as never)
          .returning();
        const [held] = await tx
          .insert(marketingEnquiry)
          .values({ ...base, intent: "private_sale_sell", status: "converted" } as never)
          .returning();
        const [file] = await tx
          .insert(uploadObject)
          .values({
            enquiryDraftId: randomUUID(),
            kind: "enquiry_image",
            key: `uploads/erase-${randomUUID()}`,
            declaredContentType: "image/jpeg",
            declaredByteSize: 10,
            status: "active",
            expiresAt: future,
          })
          .returning();
        await tx
          .insert(marketingEnquiryNote)
          .values({ enquiryId: open?.id as string, body: "Phoned her" });
        await tx.insert(marketingEnquiryAttachment).values({
          enquiryId: open?.id as string,
          uploadObjectId: file?.id as string,
          kind: "image",
          position: 0,
        });

        const first = await anonymiseEnquiries(tx as never, { kind: "email", email });
        expect(first).toEqual({ enquiries: 1, notes: 1, attachments: 1, held: 1 });

        const [after] = await tx
          .select()
          .from(marketingEnquiry)
          .where(eq(marketingEnquiry.id, open?.id as string));
        expect(after).toMatchObject({
          name: ERASED_ENQUIRY.name,
          email: ERASED_ENQUIRY.email,
          phone: null,
          message: ERASED_ENQUIRY.message,
          reference: open?.reference,
          intent: "general",
          departmentSlug: "modern",
          status: "new",
          version: (open?.version as number) + 1,
        });
        const [stillHeld] = await tx
          .select()
          .from(marketingEnquiry)
          .where(eq(marketingEnquiry.id, held?.id as string));
        expect(stillHeld?.message).toBe("I have a painting to sell");
        const [expired] = await tx
          .select()
          .from(uploadObject)
          .where(eq(uploadObject.id, file?.id as string));
        expect((expired?.expiresAt as Date).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
        const attachments = await tx
          .select()
          .from(marketingEnquiryAttachment)
          .where(eq(marketingEnquiryAttachment.enquiryId, open?.id as string));
        expect(attachments).toHaveLength(0);

        // Running it again changes nothing further and the held enquiry is still reported.
        const second = await anonymiseEnquiries(tx as never, { kind: "email", email });
        expect(second).toEqual({ enquiries: 0, notes: 0, attachments: 0, held: 1 });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  describe("a converted enquiry and the record of its deal", () => {
    const t = new Date("2026-10-01T00:00:00Z");
    const YEARS = 24 * 3_600_000 * 365;

    /**
     * Seeds a user, a seller, a work, a converted enquiry and a deal made from it, runs `scenario`
     * in a transaction that is always rolled back, and hands it what it needs to move the deal.
     */
    async function withDeal(
      scenario: (ctx: {
        tx: Database;
        email: string;
        enquiryId: string;
        dealId: string;
        userId: string;
      }) => Promise<void>,
    ) {
      // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
      const db = createDb(process.env.DATABASE_URL!);
      const rollback = new Error("rollback_test_tx");
      const suffix = randomUUID().slice(0, 8);
      const email = `deal-erase-${suffix}@example.com`;
      const userId = `erase-deal-${suffix}`;
      try {
        await db.transaction(async (tx) => {
          await tx.insert(user).values({
            id: userId,
            name: userId,
            email: `${userId}@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
          const [entity] = await tx
            .insert(legalEntity)
            .values({
              displayName: "Erase Deal Seller",
              kind: "organisation",
              subkind: "company",
              createdByUserId: userId,
              status: "approved",
              createdAt: t,
              updatedAt: t,
            })
            .returning({ id: legalEntity.id });
          const [work] = await tx
            .insert(itemSubmission)
            .values({
              legalEntityId: entity?.id as string,
              title: "Erase test work",
              status: "draft",
              submittedByUserId: userId,
            })
            .returning({ id: itemSubmission.id });
          const [enquiry] = await tx
            .insert(marketingEnquiry)
            .values({
              topic: "selling",
              name: "Ada Lovelace",
              email,
              phone: "+447000000000",
              message: "A painting to sell",
              intent: "private_sale_sell",
              status: "converted",
            } as never)
            .returning();
          const deal = await new DrizzlePrivateSaleDealRepository(tx as never).create({
            itemSubmissionId: work?.id as string,
            sourceEnquiryId: enquiry?.id as string,
            ownerUserId: userId,
            seller: { legalEntityId: entity?.id as string, actingUserId: userId },
            buyerFeeBps: 0,
            sellerCommissionBps: null,
            actorUserId: userId,
          });
          await scenario({
            tx: tx as never,
            email,
            enquiryId: enquiry?.id as string,
            dealId: deal.id,
            userId,
          });
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    }

    const message = async (tx: Database, id: string) =>
      (await tx.select().from(marketingEnquiry).where(eq(marketingEnquiry.id, id)))[0]?.message;

    const cancel = (tx: Database, dealId: string, agreed: boolean, at: Date) =>
      tx
        .update(privateSaleDeal)
        .set({
          stage: "cancelled",
          cancelReason: "Seller withdrew",
          cancelledAt: at,
          ...(agreed ? { agreedAt: at, priceMinor: 100, agreedByUserId: null } : {}),
        })
        .where(eq(privateSaleDeal.id, dealId));

    const settle = async (tx: Database, dealId: string, at: Date) => {
      await tx
        .update(privateSaleDeal)
        .set({
          stage: "settled",
          priceMinor: 100,
          agreedAt: at,
          vatTreatment: "margin_scheme",
          sellerCommissionBps: 1500,
          paymentDueAt: at,
        })
        .where(eq(privateSaleDeal.id, dealId));
      await tx.insert(privateSaleDealStageHistory).values({
        dealId,
        fromStage: "released",
        toStage: "settled",
        createdAt: at,
      });
    };

    it("holds the enquiry while the deal is open", async () => {
      await withDeal(async ({ tx, email, enquiryId }) => {
        expect(await anonymiseEnquiries(tx, { kind: "email", email })).toEqual({
          enquiries: 0,
          notes: 0,
          attachments: 0,
          held: 1,
        });
        expect(await message(tx, enquiryId)).toBe("A painting to sell");
      });
    });

    it("erases it when the deal was cancelled before agreement with no check opened", async () => {
      await withDeal(async ({ tx, email, enquiryId, dealId }) => {
        await cancel(tx, dealId, false, new Date());
        expect(await anonymiseEnquiries(tx, { kind: "email", email })).toMatchObject({
          enquiries: 1,
          held: 0,
        });
        expect(await message(tx, enquiryId)).toBe(ERASED_ENQUIRY.message);
      });
    });

    it("holds it when the deal was cancelled before agreement but a source-of-funds case was opened", async () => {
      await withDeal(async ({ tx, email, enquiryId, dealId, userId }) => {
        await tx.insert(sourceOfFunds).values({
          userId,
          trigger: "manual",
          thresholdAmount: "9000.00",
          exposureAmount: "10000.00",
        });
        await cancel(tx, dealId, false, new Date());
        expect(await anonymiseEnquiries(tx, { kind: "email", email })).toMatchObject({
          enquiries: 0,
          held: 1,
        });
        expect(await message(tx, enquiryId)).toBe("A painting to sell");
      });
    });

    it("holds it when the party was put on an anti-money-laundering hold", async () => {
      await withDeal(async ({ tx, email, enquiryId, dealId, userId }) => {
        await tx
          .insert(bidUserProfile)
          .values({
            userId,
            amlHoldStatus: "hold",
            amlHoldAt: new Date(),
            createdAt: t,
            updatedAt: t,
          })
          .onConflictDoUpdate({
            target: bidUserProfile.userId,
            set: { amlHoldStatus: "hold", amlHoldAt: new Date() },
          });
        await cancel(tx, dealId, false, new Date());
        expect(await anonymiseEnquiries(tx, { kind: "email", email })).toMatchObject({
          enquiries: 0,
          held: 1,
        });
        expect(await message(tx, enquiryId)).toBe("A painting to sell");
      });
    });

    it("holds it when a buyer who was screened was replaced before agreement", async () => {
      await withDeal(async ({ tx, email, enquiryId, dealId }) => {
        const firstBuyer = `erase-first-buyer-${randomUUID().slice(0, 8)}`;
        await tx.insert(user).values({
          id: firstBuyer,
          name: firstBuyer,
          email: `${firstBuyer}@integration.test`,
          emailVerified: true,
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(kycWatchlistScreening).values({
          userId: firstBuyer,
          providerSessionId: `session-${firstBuyer}`,
          matchStatus: "no_match",
          decisionOutcome: "clear",
        } as never);
        await tx.insert(domainEvent).values({
          aggregateType: "private_sale_deal",
          aggregateId: dealId,
          eventType: "private_sale_deal.party_named",
          payload: { dealId, reference: "PS-X", role: "buyer", actingUserId: firstBuyer },
          producer: "test",
        });
        await cancel(tx, dealId, false, new Date());
        expect(await anonymiseEnquiries(tx, { kind: "email", email })).toMatchObject({
          enquiries: 0,
          held: 1,
        });
        expect(await message(tx, enquiryId)).toBe("A painting to sell");
      });
    });

    it("holds it when the deal was cancelled after agreement, until the retention has run", async () => {
      await withDeal(async ({ tx, email, enquiryId, dealId }) => {
        const cancelledAt = new Date("2026-04-01T00:00:00Z");
        await cancel(tx, dealId, true, cancelledAt);
        const within = new Date(cancelledAt.getTime() + 4 * YEARS);
        expect(
          await anonymiseEnquiries(tx, { kind: "email", email }, { now: within }),
        ).toMatchObject({
          enquiries: 0,
          held: 1,
        });
        expect(await message(tx, enquiryId)).toBe("A painting to sell");
        const after = new Date(cancelledAt.getTime() + 6 * YEARS);
        expect(
          await anonymiseEnquiries(tx, { kind: "email", email }, { now: after }),
        ).toMatchObject({
          enquiries: 1,
          held: 0,
        });
        expect(await message(tx, enquiryId)).toBe(ERASED_ENQUIRY.message);
      });
    });

    it("holds it after the deal settles for five years, then erases it", async () => {
      await withDeal(async ({ tx, email, enquiryId, dealId }) => {
        const settledAt = new Date("2026-05-01T00:00:00Z");
        await settle(tx, dealId, settledAt);
        const within = new Date(settledAt.getTime() + 4 * YEARS);
        expect(
          await anonymiseEnquiries(tx, { kind: "email", email }, { now: within }),
        ).toMatchObject({
          enquiries: 0,
          held: 1,
        });
        expect(await message(tx, enquiryId)).toBe("A painting to sell");
        const after = new Date(settledAt.getTime() + 6 * YEARS);
        expect(
          await anonymiseEnquiries(tx, { kind: "email", email }, { now: after }),
        ).toMatchObject({
          enquiries: 1,
          held: 0,
        });
        expect(await message(tx, enquiryId)).toBe(ERASED_ENQUIRY.message);
      });
    });

    it("keeps the record longer when the retention is set longer", async () => {
      await withDeal(async ({ tx, email, dealId }) => {
        const settledAt = new Date("2026-05-01T00:00:00Z");
        await settle(tx, dealId, settledAt);
        const later = new Date(settledAt.getTime() + 6 * YEARS);
        expect(
          await anonymiseEnquiries(
            tx,
            { kind: "email", email },
            { now: later, retentionYears: 10 },
          ),
        ).toMatchObject({ enquiries: 0, held: 1 });
      });
    });
  });
});
