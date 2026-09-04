/**
 * Backfill missing `user.registered` domain events so the marketing-contacts projector
 * can sync eligible users into Brevo.
 *
 * Dry-run (default):
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-user-registered-events
 *
 * Apply:
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-user-registered-events -- --apply
 *
 * Optional:
 *   --limit=50
 *   --all-missing-events   Include users already synced via email_verified/kyc (default: only never-synced)
 */
import crypto from "node:crypto";
import {
  bidUserProfile,
  emailSuppression,
  marketingContactSyncLog,
  user,
} from "@auction/db/schema";
import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { createDb } from "../client.js";
import { publishUserRegistered } from "../services/publish-user-registered.js";

const MARKETING_EXCLUDED_ROLES = ["staff"] as const;

function emailHash(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const allMissingEvents = argv.includes("--all-missing-events");
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : undefined;
  if (limitArg && (!limit || Number.isNaN(limit) || limit <= 0)) {
    throw new Error("--limit must be a positive integer");
  }
  return { apply, allMissingEvents, limit };
}

async function main() {
  const { apply, allMissingEvents, limit } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const db = createDb(url);
  const candidates = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    })
    .from(user)
    .innerJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
    .where(
      and(
        notInArray(bidUserProfile.role, [...MARKETING_EXCLUDED_ROLES]),
        eq(bidUserProfile.emailStatus, "ok"),
        isNull(bidUserProfile.suspendedAt),
        isNull(user.deletionRequestedAt),
        sql`NOT EXISTS (
          SELECT 1 FROM domain_events de
          WHERE de.aggregate_type = 'user'
            AND de.aggregate_id = ${user.id}
            AND de.event_type = 'user.registered'
        )`,
        ...(allMissingEvents
          ? []
          : [
              sql`NOT EXISTS (
                SELECT 1 FROM ${marketingContactSyncLog} m
                WHERE m.user_id = ${user.id}
              )`,
            ]),
      ),
    )
    .orderBy(user.createdAt)
    .limit(limit ?? 10_000);

  const suppressedHashes = new Set(
    (await db.select({ emailHash: emailSuppression.emailHash }).from(emailSuppression)).map(
      (row) => row.emailHash,
    ),
  );

  const eligible = candidates.filter((row) => !suppressedHashes.has(emailHash(row.email)));

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scope: allMissingEvents ? "all-missing-events" : "never-synced-only",
        candidates: candidates.length,
        eligibleAfterSuppressionFilter: eligible.length,
        sample: eligible.slice(0, 5).map((row) => ({
          userId: row.id,
          email: row.email,
          createdAt: row.createdAt,
        })),
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to insert user.registered events.");
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of eligible) {
    const result = await publishUserRegistered(
      db,
      { userId: row.id, email: row.email, name: row.name },
      { producer: "ops/backfill-brevo", source: "backfill" },
    );
    if (result.inserted) inserted++;
    else skipped++;
  }

  console.log(`backfill complete: inserted=${inserted} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
