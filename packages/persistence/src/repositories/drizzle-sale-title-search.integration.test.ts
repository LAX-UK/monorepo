import { type Database, createDb } from "@auction/db";
import { legalEntity, sale, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleSaleRepository } from "./drizzle-sale.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const ids = {
  user: "title-search-seller",
  le: "b9e00000-0000-4000-8000-000000000001",
  winter: "b9e00000-0000-4000-8000-000000000010",
  discount: "b9e00000-0000-4000-8000-000000000020",
  rehearsal: "b9e00000-0000-4000-8000-000000000030",
  draft: "b9e00000-0000-4000-8000-000000000040",
} as const;

describe.skipIf(!HAS_DB)("sale title search (integration)", () => {
  it("matches the title literally, ignoring case, and never offers test sales to the public", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_sale_title_search");
    const t = new Date("2026-10-01T00:00:00Z");
    const start = new Date("2026-10-20T10:00:00Z");
    const end = new Date("2026-10-31T18:00:00Z");

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: ids.user,
          name: "Seller",
          email: "title-search-seller@integration.test",
          emailVerified: true,
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(legalEntity).values({
          id: ids.le,
          displayName: "Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: ids.user,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        const row = (
          id: string,
          title: string,
          over: { isTest?: boolean; status?: "active" | "draft" } = {},
        ) => ({
          id,
          title,
          status: over.status ?? ("active" as const),
          isTest: over.isTest ?? false,
          startTime: start,
          endTime: end,
          createdByLegalEntityId: ids.le,
        });
        await tx
          .insert(sale)
          .values([
            row(ids.winter, "Winter Evening Sale"),
            row(ids.discount, "100% off_everything"),
            row(ids.rehearsal, "Winter rehearsal", { isTest: true }),
            row(ids.draft, "Winter draft", { status: "draft" }),
          ]);

        const sales = new DrizzleSaleRepository(tx as unknown as Database);
        const publicFilter = {
          statuses: ["active" as const],
          excludeTestSales: true,
          limit: 20,
          offset: 0,
        };
        const found = async (q: string, over: Partial<typeof publicFilter> = {}) =>
          (await sales.list({ ...publicFilter, ...over, q })).map((s) => s.id);

        expect(await found("winter")).toEqual([ids.winter]);
        expect(await found("EVENING")).toEqual([ids.winter]);
        // `%` and `_` are ordinary characters, not wildcards.
        expect(await found("%")).toEqual([ids.discount]);
        expect(await found("off_every")).toEqual([ids.discount]);
        expect(await found("off.every")).toEqual([]);
        // Staff keep the test sale; a public filter never reaches the draft.
        expect(await found("winter", { excludeTestSales: false })).toContain(ids.rehearsal);
        expect(await found("winter")).not.toContain(ids.draft);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
