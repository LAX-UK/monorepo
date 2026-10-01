import { createHash } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { grantLaxSaleAuthority, importTestArtwork } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleBasketRepository } from "./drizzle-basket.repository.js";

function hashBasketToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

describe.skipIf(!hasShopIntegrationDb)("drizzle basket repository artwork upsert", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("upserts the same artwork line twice against the partial unique index", async () => {
    const db = createShopDb(shopPool);
    const imported = await importTestArtwork(db, "basket-upsert");
    await grantLaxSaleAuthority(db, imported.artworkId, 4);
    const repo = createDrizzleBasketRepository(db);
    const owner = {
      kind: "anonymous" as const,
      tokenHash: hashBasketToken("guest-basket-token-value01234567890123456789012"),
    };

    await repo.addOrUpdateLine({ owner, artworkSlug: imported.slug, quantity: 1 });
    const basket = await repo.addOrUpdateLine({ owner, artworkSlug: imported.slug, quantity: 2 });

    expect(basket.lines).toHaveLength(1);
    expect(basket.lines[0]?.quantity).toBe(2);
    expect(basket.lines[0]?.artworkSlug).toBe(imported.slug);
  });

  it("merges anonymous artwork lines into a subject basket via the same partial index", async () => {
    const db = createShopDb(shopPool);
    const imported = await importTestArtwork(db, "basket-merge");
    await grantLaxSaleAuthority(db, imported.artworkId, 4);
    const repo = createDrizzleBasketRepository(db);
    const fromOwner = {
      kind: "anonymous" as const,
      tokenHash: hashBasketToken("guest-basket-merge-from-token012345678901234567890"),
    };
    const toOwner = {
      kind: "subject" as const,
      identitySubjectId: `integration-subject-basket-merge-${Date.now()}`,
    };

    await repo.addOrUpdateLine({ owner: fromOwner, artworkSlug: imported.slug, quantity: 1 });
    await repo.addOrUpdateLine({ owner: toOwner, artworkSlug: imported.slug, quantity: 2 });
    const merged = await repo.mergeBaskets({ from: fromOwner, to: toOwner });

    expect(merged.lines).toHaveLength(1);
    expect(merged.lines[0]?.quantity).toBe(3);
    expect(merged.lines[0]?.artworkSlug).toBe(imported.slug);
  });
});
