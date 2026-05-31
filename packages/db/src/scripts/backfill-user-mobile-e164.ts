/**
 * Idempotent backfill: normalize user.mobile to E.164 and set mobile_country.
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-user-mobile-e164
 */
import { normalizeLegacyMobile } from "@auction/validators";
import { eq, isNotNull } from "drizzle-orm";
import { createDb } from "../client.js";
import { user } from "../schema/auth.js";

const db = createDb(process.env.DATABASE_URL ?? "");

async function main() {
  const rows = await db
    .select({ id: user.id, mobile: user.mobile, mobileCountry: user.mobileCountry })
    .from(user)
    .where(isNotNull(user.mobile));

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
      console.warn(`skip user ${row.id}: ${r.message} (${raw})`);
      skipped++;
      continue;
    }

    await db
      .update(user)
      .set({
        mobile: r.value.e164,
        mobileCountry: r.value.country,
        updatedAt: new Date(),
      })
      .where(eq(user.id, row.id));
    updated++;
  }

  console.log(`backfill complete: updated=${updated} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
