import { createDbFromPool } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleStockLocationStore,
} from "@auction/persistence/repositories";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  hasShopIntegrationDb,
  ownerUrl,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import {
  STOCK_LOCATION_E2E_LOCATION,
  type StockLocationE2eStoresOn,
  seedStockLocationE2eFixtures,
} from "./stock-location-e2e-seed.js";

const storesOn: StockLocationE2eStoresOn = (session) => ({
  register: new DrizzleArtworkRegisterRepository(session),
  locations: new DrizzleStockLocationStore(session),
});

describe.skipIf(!hasShopIntegrationDb)("seed:stock-location (Postgres)", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    // Only the owner can mark a database; the shared integration database is a local one.
    await ownerPool.query(
      `insert into demo_seed_target (environment, database_name, marked_by)
       values ('local', current_database(), 'shop integration test') on conflict do nothing`,
    );
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("writes the artworks, the location and one move through the stores, once", async () => {
    const db = createDbFromPool(ownerPool);
    const env = { databaseUrl: ownerUrl };
    const first = await seedStockLocationE2eFixtures(db, env, storesOn);
    const again = await seedStockLocationE2eFixtures(db, env, storesOn);
    // The shared database keeps them between runs, so the first run may have found them already.
    expect(again.created).toEqual([]);
    expect(again.registerIds).toEqual(first.registerIds);
    expect(again.locationId).toBe(first.locationId);

    const { register, locations } = storesOn(db);
    const location = await locations.findLocation(first.locationId);
    expect(location).toMatchObject({ name: STOCK_LOCATION_E2E_LOCATION, status: "active" });

    const seededMoves = await locations.listMoves(first.registerIds.alreadyThere, 10);
    expect(seededMoves.map((move) => move.to.id)).toContain(first.locationId);
    // Through the store, so the record's history has the move ("Location changed").
    const history = await new DrizzleArtworkRegisterRepository(db).listEvents(
      first.registerIds.alreadyThere,
      50,
    );
    expect(history.map((event) => event.type)).toEqual(
      expect.arrayContaining(["created", "location_moved"]),
    );
    for (const key of ["firstMove", "toMove"] as const) {
      expect(
        await register.findByZohoProductId(`e2e-stock-location-${key === "firstMove" ? 1 : 2}`),
      ).toMatchObject({ id: first.registerIds[key], kind: "original" });
    }
  });
});
