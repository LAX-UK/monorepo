/**
 * Issues check-in tokens for RSVPs missing one. Plain tokens are printed for ops to resend.
 * Run: pnpm --filter @auction/api exec tsx scripts/backfill-onsite-event-check-in-tokens.ts
 */
import { createDb } from "@auction/db";
import { onsiteEventRsvp } from "@auction/db/schema";
import { DrizzleOnsiteEventRepository } from "@auction/persistence/repositories";
import { and, eq, isNull } from "drizzle-orm";
import { encryptCheckInToken } from "../src/lib/check-in-token-ciphertext.js";
import { buildPassUrl, issueCheckInToken } from "../src/lib/onsite-event-check-in-token.js";

const db = createDb(process.env.DATABASE_URL ?? "");
const eventRepo = new DrizzleOnsiteEventRepository(db);
const cipherSecret = process.env.CHECK_IN_TOKEN_SECRET?.trim();

const rows = await db
  .select({
    id: onsiteEventRsvp.id,
    eventSlug: onsiteEventRsvp.eventSlug,
  })
  .from(onsiteEventRsvp)
  .where(isNull(onsiteEventRsvp.checkInTokenHash));

if (rows.length === 0) {
  console.log("No RSVPs need token backfill.");
  process.exit(0);
}

for (const row of rows) {
  const event = await eventRepo.findBySlug(row.eventSlug);
  const issued = issueCheckInToken();
  const ciphertext = cipherSecret ? encryptCheckInToken(issued.plainToken, cipherSecret) : null;
  await db
    .update(onsiteEventRsvp)
    .set({
      checkInTokenHash: issued.tokenHash,
      checkInTokenIssuedAt: new Date(),
      checkInTokenCiphertext: ciphertext,
      updatedAt: new Date(),
    })
    .where(and(eq(onsiteEventRsvp.id, row.id), isNull(onsiteEventRsvp.checkInTokenHash)));

  const passUrl = buildPassUrl(event?.micrositeUrl ?? null, issued.plainToken);
  console.log(`${row.id}\t${passUrl}`);
}

console.log(`Backfilled ${rows.length} RSVP pass token(s). Email guests these pass URLs.`);
