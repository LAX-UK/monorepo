import { type Database, createDb } from "@auction/db";
import {
  artworkRegister,
  atgAuctionLink,
  atgLotLink,
  legalEntity,
  lot,
  sale,
  user,
} from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleLotRegisterLinkReader } from "./drizzle-lot-register-link.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleLotRegisterLinkReader (integration)", () => {
  const ids = {
    sale: "a7c00000-0000-4000-8000-000000000001",
    seller: "a7c00000-0000-4000-8000-000000000002",
    winner: "a7c00000-0000-4000-8000-000000000003",
    withWinner: "a7c00000-0000-4000-8000-000000000011",
    noWinner: "a7c00000-0000-4000-8000-000000000012",
    atgSold: "a7c00000-0000-4000-8000-000000000013",
    atgUnsold: "a7c00000-0000-4000-8000-000000000014",
    noRegister: "a7c00000-0000-4000-8000-000000000015",
  };
  const sellerUserId = "lot-register-link-seller";
  const winnerUserId = "lot-register-link-winner";

  it("reads the winner and the ATG result for a lot", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_lot_register_link_test");
    const t = new Date("2026-10-01T00:00:00Z");

    try {
      await db.transaction(async (tx) => {
        for (const id of [sellerUserId, winnerUserId]) {
          await tx.insert(user).values({
            id,
            name: id,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
        }
        await tx.insert(legalEntity).values({
          id: ids.seller,
          displayName: "Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: sellerUserId,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(legalEntity).values({
          id: ids.winner,
          displayName: "Buyer",
          kind: "individual",
          createdByUserId: winnerUserId,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(sale).values({
          id: ids.sale,
          title: "ATG sale",
          startTime: new Date("2026-10-20T10:00:00Z"),
          endTime: new Date("2026-11-01T18:00:00Z"),
          createdByLegalEntityId: ids.seller,
        });
        const registers = await tx
          .insert(artworkRegister)
          .values(
            [1, 2, 3, 4].map((n) => ({
              zohoProductId: `lot-register-link-${n}`,
              stockCode: `LAX-ORI-AR-PC-26-90${n}`,
              kind: "original" as const,
              title: `Work ${n}`,
              artistName: "Ada Rowe",
              artistCode: "AR",
            })),
          )
          .returning({ id: artworkRegister.id, zohoProductId: artworkRegister.zohoProductId });
        const registerFor = (n: number) => {
          const found = registers.find((r) => r.zohoProductId === `lot-register-link-${n}`);
          if (!found) throw new Error("register missing");
          return found.id;
        };
        const base = {
          saleId: ids.sale,
          sellerLegalEntityId: ids.seller,
          auctionType: "english" as const,
          status: "ended" as const,
          startingPrice: "100",
          currentPrice: "100",
          startTime: new Date("2026-10-20T10:00:00Z"),
          endTime: new Date("2026-11-01T18:00:00Z"),
        };
        await tx.insert(lot).values([
          {
            ...base,
            id: ids.withWinner,
            lotNumber: 1,
            title: "Won",
            winnerId: ids.winner,
            artworkRegisterId: registerFor(1),
          },
          {
            ...base,
            id: ids.noWinner,
            lotNumber: 2,
            title: "Unsold",
            artworkRegisterId: registerFor(2),
          },
          {
            ...base,
            id: ids.atgSold,
            lotNumber: 3,
            title: "ATG sold",
            artworkRegisterId: registerFor(3),
          },
          {
            ...base,
            id: ids.atgUnsold,
            lotNumber: 4,
            title: "ATG unsold",
            artworkRegisterId: registerFor(4),
          },
          { ...base, id: ids.noRegister, lotNumber: 5, title: "No register" },
        ]);
        await tx.insert(atgAuctionLink).values({
          saleId: ids.sale,
          atgAuctionId: "atg-a",
          remoteStatus: "closed",
        });
        await tx.insert(atgLotLink).values([
          { lotId: ids.atgSold, saleId: ids.sale, atgLotId: "atg-l3", imageNames: [], sold: true },
          {
            lotId: ids.atgUnsold,
            saleId: ids.sale,
            atgLotId: "atg-l4",
            imageNames: [],
            sold: false,
          },
        ]);

        const reader = new DrizzleLotRegisterLinkReader(tx as unknown as Database);
        expect(await reader.findLink(ids.withWinner)).toMatchObject({
          hasWinner: true,
          soldOnAtg: false,
        });
        expect(await reader.findLink(ids.noWinner)).toMatchObject({
          hasWinner: false,
          soldOnAtg: false,
        });
        expect(await reader.findLink(ids.atgSold)).toMatchObject({
          status: "ended",
          hasWinner: false,
          soldOnAtg: true,
        });
        expect(await reader.findLink(ids.atgUnsold)).toMatchObject({ soldOnAtg: false });
        expect(await reader.findLink(ids.noRegister)).toBeNull();

        expect(await reader.soldOnAtg(ids.atgSold)).toBe(true);
        expect(await reader.soldOnAtg(ids.atgUnsold)).toBe(false);
        expect(await reader.soldOnAtg(ids.noWinner)).toBe(false);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
