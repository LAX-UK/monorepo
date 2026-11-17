#!/usr/bin/env node
/**
 * Writes the "Mirrored to Zoho" badge's fixture orders, one per state, for LAX Admin's browser
 * gate (infrastructure/seed/zoho-mirror-badge-seed.ts). Hermetic local databases only (the CI
 * stack): the delivery ledger rows are made up, so it refuses anything else.
 *
 * The ledger is written as the database owner (`DATABASE_URL`), since shop-api's own role only
 * reads it.
 */
import { closeDb, createDb, seedTargetEnvFromProcess } from "@auction/db";
import { seedZohoMirrorBadgeFixtures } from "../infrastructure/seed/zoho-mirror-badge-seed.js";

const env = seedTargetEnvFromProcess("DATABASE_URL");
if (!env.databaseUrl) throw new Error("DATABASE_URL (the database owner) is required");

const db = createDb(env.databaseUrl);
try {
  const result = await seedZohoMirrorBadgeFixtures(db, env);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} finally {
  await closeDb(db);
}
