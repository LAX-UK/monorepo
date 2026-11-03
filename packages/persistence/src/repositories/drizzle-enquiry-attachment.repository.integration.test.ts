import { type Database, createDb } from "@auction/db";
import { uploadObject, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleEnquiryAttachmentRepository } from "./drizzle-enquiry-workflow.repositories.js";
import { DrizzleMarketingEnquiryRepository } from "./drizzle-marketing-enquiry.repository.js";
import { DrizzleUploadPersistenceRepository } from "./drizzle-upload-persistence.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const SENDER = "enquiry-attachment-sender";
const DRAFT = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11";
const OTHER_DRAFT = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a99";

async function inRollback(run: (tx: Database) => Promise<void>) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDb(databaseUrl);
  const rollback = new Error("rollback_enquiry_attachment_test");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: SENDER,
        email: "enquiry-attachment-sender@example.com",
        name: "Sender",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      await run(tx as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

let counter = 0;
async function upload(
  tx: Database,
  owner: { ownerUserId: string } | { enquiryDraftId: string },
  kind: string,
  status: string,
) {
  counter += 1;
  const [row] = await tx
    .insert(uploadObject)
    .values({
      ...owner,
      kind,
      key: `uploads/test/${counter}-${Math.random()}`,
      declaredContentType: kind === "enquiry_document" ? "application/pdf" : "image/jpeg",
      declaredByteSize: 100,
      status,
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    .returning({ id: uploadObject.id });
  if (!row) throw new Error("upload insert failed");
  return row.id;
}

async function enquiry(tx: Database) {
  return new DrizzleMarketingEnquiryRepository(tx).createInTransaction(tx, {
    intent: "private_sale_sell",
    topic: "selling",
    name: "Ada",
    email: "ada@example.com",
    message: "Selling privately",
    marketingOptIn: false,
  });
}

describe.skipIf(!HAS_DB)("enquiry attachment claims (integration)", () => {
  it("attaches a draft's checked files in the order sent and leaves the rest out", async () => {
    await inRollback(async (tx) => {
      const [a, b, doc, rejected, pending, foreign] = [
        await upload(tx, { enquiryDraftId: DRAFT }, "enquiry_image", "active"),
        await upload(tx, { enquiryDraftId: DRAFT }, "enquiry_image", "active"),
        await upload(tx, { enquiryDraftId: DRAFT }, "enquiry_document", "active"),
        await upload(tx, { enquiryDraftId: DRAFT }, "enquiry_image", "rejected"),
        await upload(tx, { enquiryDraftId: DRAFT }, "enquiry_image", "pending"),
        await upload(tx, { enquiryDraftId: OTHER_DRAFT }, "enquiry_image", "active"),
      ] as string[];
      const created = await enquiry(tx);
      const claimed = await new DrizzleEnquiryAttachmentRepository().claimInTransaction(tx, {
        enquiryId: created.id,
        owner: { enquiryDraftId: DRAFT },
        uploadIds: [
          b as string,
          a as string,
          doc as string,
          rejected as string,
          pending as string,
          foreign as string,
        ],
      });
      expect(claimed).toEqual({ images: 2, documents: 1 });
      const found = await new DrizzleMarketingEnquiryRepository(tx).findByRef(created.reference);
      expect(found?.attachments.map((x) => [x.uploadObjectId, x.kind, x.position])).toEqual([
        [doc, "document", 0],
        [b, "image", 0],
        [a, "image", 1],
      ]);
    });
  });

  it("attaches a signed-in sender's files and never another person's", async () => {
    await inRollback(async (tx) => {
      const mine = await upload(tx, { ownerUserId: SENDER }, "enquiry_image", "active");
      const theirs = await upload(tx, { enquiryDraftId: DRAFT }, "enquiry_image", "active");
      const created = await enquiry(tx);
      const claimed = await new DrizzleEnquiryAttachmentRepository().claimInTransaction(tx, {
        enquiryId: created.id,
        owner: { ownerUserId: SENDER },
        uploadIds: [mine, theirs],
      });
      expect(claimed).toEqual({ images: 1, documents: 0 });
    });
  });

  it("ignores files of other kinds, even the sender's own", async () => {
    await inRollback(async (tx) => {
      const avatar = await upload(tx, { ownerUserId: SENDER }, "avatar", "active");
      const created = await enquiry(tx);
      const claimed = await new DrizzleEnquiryAttachmentRepository().claimInTransaction(tx, {
        enquiryId: created.id,
        owner: { ownerUserId: SENDER },
        uploadIds: [avatar],
      });
      expect(claimed).toEqual({ images: 0, documents: 0 });
    });
  });

  it("counts a draft's unsent files and stops counting a file once it is sent", async () => {
    await inRollback(async (tx) => {
      const first = await upload(tx, { enquiryDraftId: DRAFT }, "enquiry_image", "active");
      await upload(tx, { enquiryDraftId: DRAFT }, "enquiry_document", "pending");
      const uploads = new DrizzleUploadPersistenceRepository(tx);
      expect(await uploads.countUnsentEnquiryUploads({ enquiryDraftId: DRAFT }, new Date())).toBe(
        2,
      );
      const created = await enquiry(tx);
      await new DrizzleEnquiryAttachmentRepository().claimInTransaction(tx, {
        enquiryId: created.id,
        owner: { enquiryDraftId: DRAFT },
        uploadIds: [first],
      });
      expect(await uploads.countUnsentEnquiryUploads({ enquiryDraftId: DRAFT }, new Date())).toBe(
        1,
      );
    });
  });
});
