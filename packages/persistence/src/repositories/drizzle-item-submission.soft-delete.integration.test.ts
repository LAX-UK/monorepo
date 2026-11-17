import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  itemSubmission,
  legalEntity,
  submissionDocument,
  uploadObject,
  user,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleConsignmentStatusCountsReader } from "./drizzle-consignment-status-counts.reader.js";
import { DrizzleItemSubmissionRepository } from "./drizzle-item-submission.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const DAY = 24 * 60 * 60 * 1000;

async function inRollback(run: (tx: Database) => Promise<void>) {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const rollback = new Error("rollback_item_submission_soft_delete_test");
  try {
    await db.transaction(async (tx) => {
      await run(tx as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

/** A seller account with a way to add submissions to it. */
async function seed(tx: Database) {
  const now = new Date();
  const userId = `sd-${randomUUID().slice(0, 8)}`;
  const entityId = randomUUID();
  await tx.insert(user).values({
    id: userId,
    name: userId,
    email: `${userId}@integration.test`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await tx.insert(legalEntity).values({
    id: entityId,
    displayName: "Example Seller",
    kind: "individual",
    subkind: "private_collector",
    createdByUserId: userId,
    status: "approved",
  });
  const add = async (status: "draft" | "submitted", images: string[] = []) => {
    const [row] = await tx
      .insert(itemSubmission)
      .values({
        legalEntityId: entityId,
        title: `Work ${status}`,
        status,
        images,
        submittedByUserId: userId,
      })
      .returning({ id: itemSubmission.id });
    return row?.id as string;
  };
  return { userId, entityId, add };
}

describe.skipIf(!HAS_DB)("item submission soft delete (GAP-53)", { timeout: 60_000 }, () => {
  it("deletes only the account's draft, once, and every read leaves it out", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleItemSubmissionRepository(tx);
      const { entityId, add } = await seed(tx);
      const draft = await add("draft");
      const sent = await add("submitted");
      const kept = await add("draft");

      expect(await repo.softDeleteDraft(draft, randomUUID(), new Date())).toBe("not_found");
      expect(await repo.softDeleteDraft(sent, entityId, new Date())).toBe("not_draft");
      expect(await repo.softDeleteDraft(draft, entityId, new Date())).toBe("deleted");
      expect(await repo.softDeleteDraft(draft, entityId, new Date())).toBe("not_found");

      expect(await repo.findById(draft)).toBeNull();
      expect(await repo.findByIdForUpdate(draft)).toBeNull();
      const listed = await repo.listForLegalEntity(entityId, { limit: 50, offset: 0 });
      expect(listed.map((s) => s.id).sort()).toEqual([kept, sent].sort());
      expect(await repo.countForLegalEntity(entityId, {})).toBe(2);
      expect((await repo.countStatusForLegalEntity(entityId)).draft).toBe(1);
      const admin = await repo.listForAdmin({ legalEntityId: entityId, limit: 50, offset: 0 });
      expect(admin.map((s) => s.id)).not.toContain(draft);
      expect(await repo.countAdminForLegalEntityIds([entityId])).toBe(2);
      const stale = await repo.listStaleDraftsWithoutReminder(new Date(Date.now() + DAY), 500);
      expect(stale.map((s) => s.id)).not.toContain(draft);
      const counts = await new DrizzleConsignmentStatusCountsReader(tx).count({
        legalEntityId: entityId,
      } as never);
      expect(counts.submissions).toContainEqual({ status: "draft", count: 1 });
      // A late edit cannot reach the deleted draft.
      await expect(repo.update(draft, { title: "Changed" })).rejects.toThrow();
    });
  });

  it("purges drafts deleted more than 30 days ago with their documents, and returns their photos", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleItemSubmissionRepository(tx);
      const { userId, entityId, add } = await seed(tx);
      const now = Date.now();
      const old = await add("draft", ["submissions/old/1.jpg", "submissions/old/2.jpg"]);
      const recent = await add("draft", ["submissions/recent/1.jpg"]);
      const live = await add("draft");
      await repo.softDeleteDraft(old, entityId, new Date(now - 31 * DAY));
      await repo.softDeleteDraft(recent, entityId, new Date(now - 29 * DAY));
      const [upload] = await tx
        .insert(uploadObject)
        .values({
          ownerUserId: userId,
          kind: "submission_document",
          key: `uploads/${randomUUID()}.pdf`,
          declaredContentType: "application/pdf",
          declaredByteSize: 10,
          expiresAt: new Date(now + DAY),
          status: "active",
        } as never)
        .returning({ id: uploadObject.id });
      await tx.insert(submissionDocument).values({
        submissionId: old,
        kind: "provenance",
        uploadObjectId: upload?.id as string,
        createdByUserId: userId,
      } as never);

      const purged = await repo.purgeDeletedDrafts(new Date(now - 30 * DAY), 200);
      expect(purged).toEqual([
        { id: old, images: ["submissions/old/1.jpg", "submissions/old/2.jpg"] },
      ]);
      const left = await tx
        .select({ id: itemSubmission.id })
        .from(itemSubmission)
        .where(inArray(itemSubmission.id, [old, recent, live]));
      expect(left.map((r) => r.id).sort()).toEqual([live, recent].sort());
      const documents = await tx
        .select()
        .from(submissionDocument)
        .where(eq(submissionDocument.submissionId, old));
      expect(documents).toEqual([]);
      // Running it again removes nothing more.
      expect(await repo.purgeDeletedDrafts(new Date(now - 30 * DAY), 200)).toEqual([]);
    });
  });
});
