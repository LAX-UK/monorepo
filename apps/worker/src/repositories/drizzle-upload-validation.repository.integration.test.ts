import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { marketingEnquiry, marketingEnquiryAttachment, uploadObject } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleUploadValidationRepository } from "./drizzle-upload-validation.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("unsent enquiry uploads (integration)", () => {
  it("finds expired enquiry files that no enquiry holds, in any state, and nothing else", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const past = new Date(Date.now() - 3_600_000);
    const future = new Date(Date.now() + 3_600_000);
    const draft = randomUUID();
    const file = (kind: string, status: string, expiresAt: Date, suffix: string) => ({
      enquiryDraftId: draft,
      kind,
      key: `uploads/${tag}-${suffix}`,
      declaredContentType: "image/jpeg",
      declaredByteSize: 10,
      status,
      expiresAt,
    });

    try {
      await db.transaction(async (tx) => {
        const rows = await tx
          .insert(uploadObject)
          .values([
            file("enquiry_image", "active", past, "expired-active"),
            file("enquiry_image", "rejected", past, "expired-rejected"),
            file("enquiry_document", "pending", past, "expired-pending"),
            file("enquiry_image", "active", future, "fresh"),
            file("enquiry_image", "active", past, "sent"),
            file("avatar", "active", past, "other-kind"),
          ])
          .returning({ id: uploadObject.id, key: uploadObject.key });
        const sent = rows.find((r) => r.key.endsWith("-sent"));
        const [enquiry] = await tx
          .insert(marketingEnquiry)
          .values({
            topic: "selling",
            name: "Ada",
            email: "ada@example.com",
            message: "Selling privately",
          } as never)
          .returning({ id: marketingEnquiry.id });
        await tx.insert(marketingEnquiryAttachment).values({
          enquiryId: (enquiry as { id: string }).id,
          uploadObjectId: (sent as { id: string }).id,
          kind: "image",
          position: 0,
        });

        const found = await new DrizzleUploadValidationRepository(
          tx as never,
        ).findExpiredUnsentEnquiryUploads(new Date());
        const keys = found
          .map((f) => f.key.replace(`uploads/${tag}-`, ""))
          .filter((k) => !k.startsWith("uploads/"));
        expect(keys.sort()).toEqual(["expired-active", "expired-pending", "expired-rejected"]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
