import { randomUUID } from "node:crypto";
import { SUBJECT_EXPORT_MAX_PAGE_RECORDS } from "@auction/identity-contracts";
import { createIdentityDb } from "@auction/identity-db";
import { subjectDataExport, user } from "@auction/identity-db/schema";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RequestsExportCategory } from "./requests.category.js";

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * The real Identity wiring across a page boundary: one more earlier download than a page holds.
 * The second page resumes from the cursor with no record skipped or repeated, and another
 * person's downloads never appear.
 */
describe.skipIf(!DATABASE_URL)("Download my data: requests page boundary (integration)", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const run = randomUUID().slice(0, 8);
  const ANN = `req-page-${run}-ann`;
  const BEN = `req-page-${run}-ben`;
  const total = SUBJECT_EXPORT_MAX_PAGE_RECORDS + 1;
  const expectedIds: string[] = [];
  const now = new Date("2026-11-12T10:00:00.000Z");

  beforeAll(async () => {
    if (!db) return;
    await db.insert(user).values(
      [ANN, BEN].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        createdAt: now,
        updatedAt: now,
      })),
    );
    const row = (subjectId: string) => ({
      id: randomUUID(),
      subjectId,
      status: "deleted",
      productProgress: { account: "done", bid: "done", shop: "done" },
      requestedAt: now,
      dueAt: now,
      deletedAt: now,
    });
    const mine = Array.from({ length: total }, () => row(ANN));
    await db.insert(subjectDataExport).values([...mine, row(BEN)]);
    expectedIds.push(...mine.map((entry) => entry.id).sort());
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(subjectDataExport).where(inArray(subjectDataExport.subjectId, [ANN, BEN]));
    await db.delete(user).where(inArray(user.id, [ANN, BEN]));
  });

  it("pages across the boundary with every record once, in key order", async () => {
    if (!db) return;
    const category = new RequestsExportCategory(db);
    expect(await category.count(ANN)).toBe(total);
    const first = await category.readPage(ANN, null);
    expect(first.records).toHaveLength(SUBJECT_EXPORT_MAX_PAGE_RECORDS);
    expect(first.nextCursor).not.toBeNull();
    const second = await category.readPage(ANN, first.nextCursor);
    expect(second.records).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect([...first.records, ...second.records].map((record) => record.id)).toEqual(expectedIds);
  });
});
