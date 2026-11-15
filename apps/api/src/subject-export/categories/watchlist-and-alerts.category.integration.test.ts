import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { savedSearch } from "@auction/db/schema";
import { SUBJECT_EXPORT_MAX_PAGE_RECORDS } from "@auction/identity-contracts";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WatchlistAndAlertsCategory } from "./watchlist-and-alerts.category.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The real Bid wiring across a page boundary: one more record than a page holds, behind three
 * sources that are empty for this person. The second page resumes from the cursor with no record
 * skipped or repeated, and the person's own records only.
 */
describe.skipIf(!HAS_DB)(
  "Download my data: watchlist and alerts page boundary (integration)",
  () => {
    const run = randomUUID().slice(0, 8);
    const owner = `wl-page-owner-${run}`;
    const stranger = `wl-page-stranger-${run}`;
    const total = SUBJECT_EXPORT_MAX_PAGE_RECORDS + 1;
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const category = new WatchlistAndAlertsCategory({
      db,
      files: {} as never,
      webOrigin: "https://bid.example",
    });
    const expectedIds: string[] = [];

    beforeAll(async () => {
      const now = new Date();
      await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${owner}, 'Owner', ${`${owner}@integration.test`}, true, ${now}, ${now}),
             (${stranger}, 'Stranger', ${`${stranger}@integration.test`}, true, ${now}, ${now})`);
      const rows = Array.from({ length: total }, (_, i) => ({
        id: randomUUID(),
        userId: owner,
        label: `Search ${i}`,
        query: { q: String(i) },
      }));
      await db.insert(savedSearch).values(rows);
      await db
        .insert(savedSearch)
        .values({ userId: stranger, label: "Not yours", query: { q: "x" } });
      expectedIds.push(...rows.map((row) => row.id).sort());
    });

    afterAll(async () => {
      await db.delete(savedSearch).where(eq(savedSearch.userId, owner));
      await db.delete(savedSearch).where(eq(savedSearch.userId, stranger));
      await db.execute(sql`delete from "user" where id in (${owner}, ${stranger})`);
    });

    it("pages across the boundary with every record once, in key order", async () => {
      expect(await category.count(owner)).toBe(total);
      const first = await category.readPage(owner, null);
      expect(first.records).toHaveLength(SUBJECT_EXPORT_MAX_PAGE_RECORDS);
      expect(first.nextCursor).not.toBeNull();
      const second = await category.readPage(owner, first.nextCursor);
      expect(second.records).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      const ids = [...first.records, ...second.records].map((record) => record.id);
      expect(ids).toEqual(expectedIds);
    });
  },
);
