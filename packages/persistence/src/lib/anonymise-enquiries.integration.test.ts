import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  itemSubmission,
  legalEntity,
  marketingEnquiry,
  marketingEnquiryAttachment,
  marketingEnquiryNote,
  privateSaleDeal,
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

  it("holds a converted enquiry while its deal is open and erases it once the deal has ended", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const suffix = randomUUID().slice(0, 8);
    const email = `deal-erase-${suffix}@example.com`;
    const userId = `erase-deal-${suffix}`;
    const t = new Date("2026-10-01T00:00:00Z");

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
        const deals = new DrizzlePrivateSaleDealRepository(tx as never);
        const deal = await deals.create({
          itemSubmissionId: work?.id as string,
          sourceEnquiryId: enquiry?.id as string,
          ownerUserId: userId,
          seller: { legalEntityId: entity?.id as string, actingUserId: userId },
          buyerFeeBps: 0,
          sellerCommissionBps: null,
          actorUserId: userId,
        });

        // The deal is open: the enquiry is held, unchanged.
        expect(await anonymiseEnquiries(tx as never, { kind: "email", email })).toEqual({
          enquiries: 0,
          notes: 0,
          attachments: 0,
          held: 1,
        });
        const [kept] = await tx
          .select()
          .from(marketingEnquiry)
          .where(eq(marketingEnquiry.id, enquiry?.id as string));
        expect(kept?.message).toBe("A painting to sell");

        // The deal ends: the hold is released and the enquiry is erased.
        await tx
          .update(privateSaleDeal)
          .set({ stage: "cancelled", cancelReason: "Seller withdrew", cancelledAt: new Date() })
          .where(eq(privateSaleDeal.id, deal.id));
        expect(await anonymiseEnquiries(tx as never, { kind: "email", email })).toEqual({
          enquiries: 1,
          notes: 0,
          attachments: 0,
          held: 0,
        });
        const [erased] = await tx
          .select()
          .from(marketingEnquiry)
          .where(eq(marketingEnquiry.id, enquiry?.id as string));
        expect(erased).toMatchObject({
          name: ERASED_ENQUIRY.name,
          email: ERASED_ENQUIRY.email,
          message: ERASED_ENQUIRY.message,
          status: "converted",
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
