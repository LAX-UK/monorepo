#!/usr/bin/env node
/**
 * Writes the release-alert send log's fixture releases, one per status, for LAX Admin's browser
 * gate (infrastructure/seed/release-alert-sends-seed.ts). Hermetic local databases only (the CI
 * stack): the alert rows are made up, so it refuses anything else.
 *
 * The rows are written as the database owner (`DATABASE_URL`), as the other fixture seeds are.
 */
import { closeDb, createDb, seedTargetEnvFromProcess } from "@auction/db";
import { seedReleaseAlertSendFixtures } from "../infrastructure/seed/release-alert-sends-seed.js";

const env = seedTargetEnvFromProcess("DATABASE_URL");
if (!env.databaseUrl) throw new Error("DATABASE_URL (the database owner) is required");

const db = createDb(env.databaseUrl);
try {
  const result = await seedReleaseAlertSendFixtures(db, env);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} finally {
  await closeDb(db);
}
