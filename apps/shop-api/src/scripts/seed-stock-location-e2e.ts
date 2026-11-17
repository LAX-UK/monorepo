#!/usr/bin/env node
/**
 * Writes the stock location fixture artworks and location for LAX Admin's browser gate
 * (infrastructure/seed/stock-location-e2e-seed.ts). Hermetic local databases only (the CI stack):
 * the records are made up, so it refuses anything else. Safe to run again.
 *
 * Written as the database owner (`DATABASE_URL`), like the other fixture seeds the gate runs.
 */
import { closeDb, createDb, seedTargetEnvFromProcess } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleStockLocationStore,
} from "@auction/persistence/repositories";
import { seedStockLocationE2eFixtures } from "../infrastructure/seed/stock-location-e2e-seed.js";

const env = seedTargetEnvFromProcess("DATABASE_URL");
if (!env.databaseUrl) throw new Error("DATABASE_URL (the database owner) is required");

const db = createDb(env.databaseUrl);
try {
  const result = await seedStockLocationE2eFixtures(db, env, (session) => ({
    register: new DrizzleArtworkRegisterRepository(session),
    locations: new DrizzleStockLocationStore(session),
  }));
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} finally {
  await closeDb(db);
}
