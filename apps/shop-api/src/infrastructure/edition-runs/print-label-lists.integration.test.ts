import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importTestArtwork } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleAdminLookupReader } from "../drizzle-admin-lookup.reader.js";

describe.skipIf(!hasShopIntegrationDb)("print labels in staff lists", { timeout: 60_000 }, () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("names each print of a LAX standard run by its number and the run's size", async () => {
    const db = createShopDb(shopPool);
    const imported = await importTestArtwork(db, "print-label");
    const editions = await createDrizzleAdminLookupReader(db).searchEditions({
      q: "Integration print-label",
      limit: 100,
    });
    const labels = editions
      .filter((edition) => edition.artworkId === imported.artworkId)
      .map((edition) => edition.printLabel);
    expect(labels).toHaveLength(24);
    expect(labels).toContain("1/24");
    expect(labels).toContain("24/24");
    expect(labels.every((label) => /^\d+\/24$/.test(label))).toBe(true);
  });
});
