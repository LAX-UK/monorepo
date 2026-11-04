import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  marketingEnquiry,
  marketingEnquiryAttachment,
  marketingEnquiryNote,
  uploadObject,
} from "@auction/db/schema";
import { ERASED_ENQUIRY } from "@auction/domain";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
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
});
