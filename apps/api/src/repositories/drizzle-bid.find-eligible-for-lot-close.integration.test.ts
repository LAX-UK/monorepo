import { createDb } from "@auction/db";
import { bid, legalEntity, legalEntityMember, lot, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleBidRepository } from "./drizzle-bid.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleBidRepository.findEligibleBidsForLotClose (integration)", () => {
  const sellerUserId = "p21_seller_u";
  const sellerLeId = "11111111-1111-4111-8111-111111111111";
  const lotId = "22222222-2222-4222-8222-222222222222";
  const buyerUser = (i: number) => `p21_b${i}_u`;
  /** Deterministic UUIDs for buyer legal entities (i = 0..9); last segment is 12 hex digits. */
  const buyerLeId = (i: number) =>
    `80000000-0000-4000-8000-${String(10_000 + i).padStart(12, "0")}`;

  it("returns the first reserve-eligible bid that passes anti-shilling (4th of 10 by hammer)", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");

    try {
      await db.transaction(async (tx) => {
        const t = new Date();
        await tx.insert(user).values({
          id: sellerUserId,
          name: "Seller",
          email: "p21_seller_u@integration.test",
          emailVerified: true,
          createdAt: t,
          updatedAt: t,
        });
        for (let i = 0; i < 10; i++) {
          await tx.insert(user).values({
            id: buyerUser(i),
            name: `B${i}`,
            email: `p21_b${i}_u@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
        }

        await tx.insert(legalEntity).values({
          id: sellerLeId,
          displayName: "Seller Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: sellerUserId,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });

        await tx.insert(legalEntityMember).values({
          legalEntityId: sellerLeId,
          userId: sellerUserId,
          role: "owner",
          isPrimaryAdmin: true,
          acceptedAt: t,
          createdAt: t,
        });

        for (let i = 0; i < 10; i++) {
          const leId = buyerLeId(i);
          await tx.insert(legalEntity).values({
            id: leId,
            displayName: `Buyer LE ${i}`,
            kind: "individual",
            subkind: "private_collector",
            createdByUserId: buyerUser(i),
            status: "approved",
            createdAt: t,
            updatedAt: t,
          });
          await tx.insert(legalEntityMember).values({
            legalEntityId: leId,
            userId: buyerUser(i),
            role: "owner",
            isPrimaryAdmin: true,
            acceptedAt: t,
            createdAt: t,
          });
        }

        for (const i of [0, 1, 2]) {
          await tx.insert(legalEntityMember).values({
            legalEntityId: sellerLeId,
            userId: buyerUser(i),
            role: "consignor",
            isPrimaryAdmin: false,
            acceptedAt: t,
            createdAt: t,
          });
        }

        await tx.insert(lot).values({
          id: lotId,
          sellerLegalEntityId: sellerLeId,
          title: "P21 lot",
          images: [],
          auctionType: "english",
          startingPrice: "100.00",
          reservePrice: "100.00",
          currentPrice: "1000.00",
          startTime: new Date(t.getTime() - 86_400_000),
          endTime: new Date(t.getTime() - 3600_000),
          status: "active",
          createdAt: t,
          updatedAt: t,
        });

        for (let i = 0; i < 10; i++) {
          const amt = 1000 - i * 100;
          await tx.insert(bid).values({
            lotId,
            bidderId: buyerUser(i),
            buyerLegalEntityId: buyerLeId(i),
            amount: `${amt}.00`,
            isWinning: false,
            isAutoBid: false,
            maxAutoBidAmount: null,
            createdAt: new Date(t.getTime() + i * 1000),
          });
        }

        const repo = new DrizzleBidRepository(tx);
        const eligible = await repo.findEligibleBidsForLotClose(lotId, {
          sellerLegalEntityId: sellerLeId,
          reservePrice: "100.00",
          sort: "english",
        });

        // Repo returns all SQL-eligible rows (same as production reads via sqlEligible[0]).
        expect(eligible).toHaveLength(7);
        const winner = eligible[0];
        if (!winner) throw new Error("expected eligible winner");
        expect(winner.placedByUserId).toBe(buyerUser(3));
        expect(winner.amount).toBe("700.00");

        throw rollback;
      });
    } catch (e) {
      if (e instanceof Error && e.message === rollback.message) return;
      throw e;
    }
  });

  it("returns empty when every reserve-eligible bid violates anti-shilling", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const lotId2 = "44444444-4444-4444-8444-444444444444";

    try {
      await db.transaction(async (tx) => {
        const t = new Date();
        await tx.insert(user).values({
          id: `${sellerUserId}_2`,
          name: "Seller2",
          email: "p21_seller2_u@integration.test",
          emailVerified: true,
          createdAt: t,
          updatedAt: t,
        });
        for (let i = 0; i < 3; i++) {
          await tx.insert(user).values({
            id: `${buyerUser(i)}_2`,
            name: `B${i}2`,
            email: `p21_b${i}_u2@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
        }

        const leSeller = "55555555-5555-4555-8555-555555555555";
        await tx.insert(legalEntity).values({
          id: leSeller,
          displayName: "Seller2 LE",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: `${sellerUserId}_2`,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(legalEntityMember).values({
          legalEntityId: leSeller,
          userId: `${sellerUserId}_2`,
          role: "owner",
          isPrimaryAdmin: true,
          acceptedAt: t,
          createdAt: t,
        });

        const buyerLeA = "66666666-6666-4666-8666-666666666666";
        const buyerLeB = "77777777-7777-4777-8777-777777777777";
        const buyerLeC = "88888888-8888-4888-8888-888888888888";

        const buyers2 = [
          { uid: `${buyerUser(0)}_2`, le: buyerLeA },
          { uid: `${buyerUser(1)}_2`, le: buyerLeB },
          { uid: `${buyerUser(2)}_2`, le: buyerLeC },
        ];

        for (const { uid, le } of buyers2) {
          await tx.insert(legalEntity).values({
            id: le,
            displayName: `LE ${uid}`,
            kind: "individual",
            subkind: "private_collector",
            createdByUserId: uid,
            status: "approved",
            createdAt: t,
            updatedAt: t,
          });
          await tx.insert(legalEntityMember).values({
            legalEntityId: le,
            userId: uid,
            role: "owner",
            isPrimaryAdmin: true,
            acceptedAt: t,
            createdAt: t,
          });
          await tx.insert(legalEntityMember).values({
            legalEntityId: leSeller,
            userId: uid,
            role: "consignor",
            isPrimaryAdmin: false,
            acceptedAt: t,
            createdAt: t,
          });
        }

        await tx.insert(lot).values({
          id: lotId2,
          sellerLegalEntityId: leSeller,
          title: "P21 lot all shill",
          images: [],
          auctionType: "english",
          startingPrice: "100.00",
          reservePrice: "100.00",
          currentPrice: "500.00",
          startTime: new Date(t.getTime() - 86_400_000),
          endTime: new Date(t.getTime() - 3600_000),
          status: "active",
          createdAt: t,
          updatedAt: t,
        });

        for (let i = 0; i < 3; i++) {
          const entry = buyers2[i];
          if (!entry) throw new Error("expected buyer entry");
          const { uid, le } = entry;
          const amt = 500 - i * 50;
          await tx.insert(bid).values({
            lotId: lotId2,
            bidderId: uid,
            buyerLegalEntityId: le,
            amount: `${amt}.00`,
            isWinning: false,
            isAutoBid: false,
            maxAutoBidAmount: null,
            createdAt: new Date(t.getTime() + i * 1000),
          });
        }

        const repo = new DrizzleBidRepository(tx);
        const eligible = await repo.findEligibleBidsForLotClose(lotId2, {
          sellerLegalEntityId: leSeller,
          reservePrice: "100.00",
          sort: "english",
        });

        expect(eligible).toHaveLength(0);

        throw rollback;
      });
    } catch (e) {
      if (e instanceof Error && e.message === rollback.message) return;
      throw e;
    }
  });
});
