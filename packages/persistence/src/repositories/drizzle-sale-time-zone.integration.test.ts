import { type Database, createDb } from "@auction/db";
import { legalEntity, sale, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleSaleRepository } from "./drizzle-sale.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const ids = {
  user: "sale-zone-seller",
  le: "b9e00000-0000-4000-8000-000000000001",
  rawSale: "b9e00000-0000-4000-8000-000000000010",
} as const;

describe.skipIf(!HAS_DB)("a sale's time zone (integration)", () => {
  it("defaults to London, is written on create and update, and refuses a non-place value", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_sale_zone");
    const t = new Date("2026-10-01T00:00:00Z");
    const start = new Date("2026-12-01T10:00:00Z");
    const end = new Date("2026-12-08T10:00:00Z");

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: ids.user,
          name: "Seller",
          email: "sale-zone-seller@integration.test",
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

        // A row written without a zone, as every sale was before the column, reads as London.
        await tx.insert(sale).values({
          id: ids.rawSale,
          title: "Existing sale",
          startTime: start,
          endTime: end,
          createdByLegalEntityId: ids.le,
        });
        const [raw] = await tx.select().from(sale).where(eq(sale.id, ids.rawSale));
        expect(raw?.timeZone).toBe("Europe/London");

        const conn = tx as unknown as Database;
        const sales = new DrizzleSaleRepository(conn);
        expect((await sales.findById(ids.rawSale))?.timeZone).toBe("Europe/London");

        const input = { title: "Paris sale", startTime: start, endTime: end };
        const created = await sales.create({
          ...input,
          createdByLegalEntityId: ids.le,
          timeZone: "Europe/Paris",
        });
        expect(created.timeZone).toBe("Europe/Paris");

        const defaulted = await sales.create({ ...input, createdByLegalEntityId: ids.le });
        expect(defaulted.timeZone).toBe("Europe/London");

        const moved = await sales.update(created.id, { timeZone: "Asia/Dubai" });
        expect(moved.timeZone).toBe("Asia/Dubai");
        const untouched = await sales.update(created.id, { title: "Renamed" });
        expect(untouched.timeZone).toBe("Asia/Dubai");

        // The first publish is stamped once and survives unpublishing; from then on the zone
        // cannot be written, so a publish racing a zone change cannot lose the lock.
        expect(created.firstPublishedAt).toBeNull();
        await sales.updateStatus(created.id, "scheduled");
        const stamped = (await sales.findById(created.id))?.firstPublishedAt;
        expect(stamped).toBeInstanceOf(Date);
        await sales.updateStatus(created.id, "draft");
        expect((await sales.findById(created.id))?.firstPublishedAt).toEqual(stamped);
        await expect(sales.update(created.id, { timeZone: "Europe/Paris" })).rejects.toThrow();
        const stillMoves = await sales.update(created.id, { title: "Renamed again" });
        expect(stillMoves.timeZone).toBe("Asia/Dubai");

        // The database itself refuses UTC and fixed-offset names (inside a savepoint).
        await expect(
          tx.transaction(async (inner) => {
            await inner.update(sale).set({ timeZone: "UTC" }).where(eq(sale.id, ids.rawSale));
          }),
        ).rejects.toThrow();
        await expect(
          tx.transaction(async (inner) => {
            await inner.update(sale).set({ timeZone: "Etc/GMT+5" }).where(eq(sale.id, ids.rawSale));
          }),
        ).rejects.toThrow();
        throw rollback;
      });
    } catch (err) {
      if (err !== rollback) throw err;
    }
  });
});
