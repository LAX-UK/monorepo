/**
 * Idempotent backfill: normalize bid_user_profile.mobile to E.164 and set mobile_country.
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-user-mobile-e164
 */
import { normalizeLegacyMobile } from "@auction/validators";
import { eq, isNotNull } from "drizzle-orm";
import { createDb } from "../client.js";
import { bidUserProfile } from "../schema/bid-user-profile.js";

const db = createDb(process.env.DATABASE_URL ?? "");

async function main() {
  const rows = await db
    .select({
      userId: bidUserProfile.userId,
      mobile: bidUserProfile.mobile,
      mobileCountry: bidUserProfile.mobileCountry,
    })
    .from(bidUserProfile)
    .where(isNotNull(bidUserProfile.mobile));

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const raw = row.mobile?.trim();
    if (!raw) continue;
    if (raw.startsWith("+") && row.mobileCountry) {
      skipped++;
      continue;
    }

    const r = normalizeLegacyMobile(raw, row.mobileCountry ?? "GB");
    if (!r.ok) {
      console.warn(`skip profile ${row.userId}: ${r.message} (${raw})`);
      skipped++;
      continue;
    }

    await db
      .update(bidUserProfile)
      .set({
        mobile: r.value.e164,
        mobileCountry: r.value.country,
        updatedAt: new Date(),
      })
      .where(eq(bidUserProfile.userId, row.userId));
    updated++;
  }

  console.log(`backfill complete: updated=${updated} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
