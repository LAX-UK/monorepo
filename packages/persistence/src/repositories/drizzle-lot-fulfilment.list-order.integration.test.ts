import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, lot, lotFulfilment, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import type { AdminLotFulfilmentListSort } from "../interfaces/lot-fulfilment.repository.js";
import { DrizzleLotFulfilmentRepository } from "./drizzle-lot-fulfilment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const hour = 3_600_000;
const base = Date.UTC(2026, 5, 1, 9, 0, 0);
const at = (hours: number) => new Date(base + hours * hour);

/**
 * The staff Lot fulfilment list orders on the server: most recently changed first by default, and
 * by lot title or last change both ways, always ending on the fulfilment id so rows that tie keep
 * one order and pages never overlap. Runs in a transaction that is rolled back.
 */
describe.skipIf(!HAS_DB)("lot fulfilment list ordering (integration)", () => {
  async function inRollback(
    run: (ctx: {
      repo: DrizzleLotFulfilmentRepository;
      tag: string;
      alpha: string;
      bravo: string;
      charlie: string;
      tiedAscending: string[];
    }) => Promise<void>,
  ) {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        const ownerId = `fulfilment-order-${tag}`;
        const sellerId = randomUUID();
        await tx.insert(user).values({
          id: ownerId,
          name: ownerId,
          email: `${ownerId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(legalEntity).values({
          id: sellerId,
          displayName: `Fulfilment order seller ${tag}`,
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: ownerId,
          status: "approved",
          createdAt: now,
          updatedAt: now,
        });

        // alpha: oldest change; bravo: newest of the distinct three; charlie: middle. The two
        // "delta" rows tie on title and on last change, so only the fulfilment id can order them.
        const rows = [
          { key: "alpha", title: `${tag} alpha`, updated: 0 },
          { key: "bravo", title: `${tag} bravo`, updated: 20 },
          { key: "charlie", title: `${tag} charlie`, updated: 10 },
          { key: "delta-1", title: `${tag} delta`, updated: 30 },
          { key: "delta-2", title: `${tag} delta`, updated: 30 },
        ];
        const ids: Record<string, string> = {};
        for (const row of rows) {
          const lotId = randomUUID();
          const fulfilmentId = randomUUID();
          ids[row.key] = fulfilmentId;
          await tx.insert(lot).values({
            id: lotId,
            sellerLegalEntityId: sellerId,
            title: row.title,
            images: [],
            auctionType: "english",
            startingPrice: "100.00",
            currentPrice: "100.00",
            minBidIncrement: "10.00",
            startTime: new Date(now.getTime() - 86_400_000),
            endTime: new Date(now.getTime() + 86_400_000),
            status: "draft",
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(lotFulfilment).values({
            id: fulfilmentId,
            lotId,
            createdAt: at(row.updated),
            updatedAt: at(row.updated),
          });
        }

        await run({
          repo: new DrizzleLotFulfilmentRepository(tx),
          tag,
          alpha: ids.alpha as string,
          bravo: ids.bravo as string,
          charlie: ids.charlie as string,
          tiedAscending: [ids["delta-1"] as string, ids["delta-2"] as string].sort(),
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  it("lists the most recently changed first when no sort is given, and for updated_desc", async () => {
    await inRollback(async ({ repo, tag, alpha, bravo, charlie, tiedAscending }) => {
      const expected = [...[...tiedAscending].reverse(), bravo, charlie, alpha];
      const byDefault = await repo.listForAdmin({ q: tag });
      expect(byDefault.items.map((row) => row.id)).toEqual(expected);
      const explicit = await repo.listForAdmin({ q: tag, sort: "updated_desc" });
      expect(explicit.items.map((row) => row.id)).toEqual(expected);
      expect(byDefault.total).toBe(5);
    });
  });

  it("orders by every sortable column, ties by fulfilment id in the same direction", async () => {
    await inRollback(async ({ repo, tag, alpha, bravo, charlie, tiedAscending }) => {
      const tiedDescending = [...tiedAscending].reverse();
      const expected: Record<AdminLotFulfilmentListSort, string[]> = {
        updated_desc: [...tiedDescending, bravo, charlie, alpha],
        updated_asc: [alpha, charlie, bravo, ...tiedAscending],
        lot_asc: [alpha, bravo, charlie, ...tiedAscending],
        lot_desc: [...tiedDescending, charlie, bravo, alpha],
      };
      for (const [sort, ids] of Object.entries(expected) as [
        AdminLotFulfilmentListSort,
        string[],
      ][]) {
        const { items } = await repo.listForAdmin({ q: tag, sort });
        expect(
          items.map((row) => row.id),
          sort,
        ).toEqual(ids);
      }
    });
  });

  it("pages through each order without repeating or skipping a row", async () => {
    await inRollback(async ({ repo, tag }) => {
      const sorts: AdminLotFulfilmentListSort[] = [
        "updated_desc",
        "updated_asc",
        "lot_asc",
        "lot_desc",
      ];
      for (const sort of sorts) {
        const whole = await repo.listForAdmin({ q: tag, sort });
        const paged: string[] = [];
        for (let offset = 0; offset < whole.items.length; offset += 2) {
          const page = await repo.listForAdmin({ q: tag, sort, limit: 2, offset });
          paged.push(...page.items.map((row) => row.id));
        }
        expect(paged, sort).toEqual(whole.items.map((row) => row.id));
      }
    });
  });
});
