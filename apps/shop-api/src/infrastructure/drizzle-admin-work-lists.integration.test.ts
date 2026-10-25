import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  importTestArtwork,
  insertTestOwnerParty,
  integrationSuffix,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleAdminReadRepository } from "./drizzle-admin-read.repository.js";
import { createDrizzlePortalOwnershipRepository } from "./drizzle-portal-ownership.repository.js";
import { rejectSaleAuthorityRequest } from "./reject-sale-authority-request.js";

/*
 * The work lists through the sale limit requests list: views counted per status under the
 * search, newest or oldest first with the id breaking ties, keyset pages that neither skip nor
 * repeat, and a decline reason kept apart from the seller's own note.
 */
describe.skipIf(!hasShopIntegrationDb)("drizzle admin work lists", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  async function seedRequests(count: number, createdAt: (index: number) => string) {
    const db = createShopDb(shopPool);
    const marker = integrationSuffix("req").replace(/[^a-z0-9]/gi, "");
    const artwork = await importTestArtwork(db, `work-list-${marker}`);
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const subject = `${marker}-owner-${index}`;
      const ownerPartyId = await insertTestOwnerParty(db, {
        identitySubjectId: subject,
        displayName: `Owner ${marker} ${index}`,
      });
      const { rows } = await ownerPool.query<{ id: string }>(
        `insert into shop_sale_authority_request
           (artwork_id, owner_party_id, requested_count, note, status, created_at)
         values ($1, $2, 2, $3, 'pending', $4::timestamptz)
         returning id`,
        [artwork.artworkId, ownerPartyId, `Seller note ${index}`, createdAt(index)],
      );
      ids.push(rows[0]?.id ?? "");
    }
    return { db, marker, ids, artworkId: artwork.artworkId };
  }

  it("counts each status under the search and pages both ways without gaps", async () => {
    // Two requests share a timestamp, so the id decides their order.
    const { db, marker, ids } = await seedRequests(5, (index) =>
      index < 2 ? "2026-03-01T10:00:00.000Z" : `2026-03-0${index}T10:00:00.000Z`,
    );
    const repo = createDrizzleAdminReadRepository(db);
    await rejectSaleAuthorityRequest(db, {
      requestId: ids[4] ?? "",
      reason: "We need the signed agreement.",
      operatorSubjectId: "integration-staff",
    });

    const first = await repo.saleAuthorityRequests.listRequests({ q: marker, limit: 2 });
    expect(first.counts).toEqual({ pending: 4, rejected: 1 });

    for (const direction of ["desc", "asc"] as const) {
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await repo.saleAuthorityRequests.listRequests({
          q: marker,
          limit: 2,
          sort: direction === "asc" ? "created_asc" : "created_desc",
          ...(cursor ? { cursor } : {}),
        });
        seen.push(...page.items.map((item) => item.requestId));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      expect(new Set(seen).size).toBe(5);
      expect(seen.sort()).toEqual([...ids].sort());
    }

    const pending = await repo.saleAuthorityRequests.listRequests({
      q: marker,
      status: "pending",
    });
    expect(pending.items).toHaveLength(4);
    expect(pending.counts).toEqual({ pending: 4, rejected: 1 });
  });

  it("keeps the seller's note and shows them the decline reason", async () => {
    const { db, marker, ids } = await seedRequests(1, () => "2026-04-01T10:00:00.000Z");
    const requestId = ids[0] ?? "";
    await rejectSaleAuthorityRequest(db, {
      requestId,
      reason: "The certificate is for another edition.",
      operatorSubjectId: "integration-staff",
    });

    const repo = createDrizzleAdminReadRepository(db);
    const listed = await repo.saleAuthorityRequests.listRequests({ q: marker });
    expect(listed.items[0]).toMatchObject({
      requestId,
      status: "rejected",
      note: "Seller note 0",
      declineReason: "The certificate is for another edition.",
    });

    const portal = createDrizzlePortalOwnershipRepository(db);
    const seller = await portal.listSaleAuthorityRequests(`${marker}-owner-0`);
    expect(seller.find((item) => item.requestId === requestId)).toMatchObject({
      note: "Seller note 0",
      declineReason: "The certificate is for another edition.",
    });
  });
});
