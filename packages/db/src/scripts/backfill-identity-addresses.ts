/**
 * Idempotent: copies Bid addresses that the identity address book does not hold yet.
 *
 * Migration 0224 already copied every address whose country was an ISO code or a common United
 * Kingdom or United States spelling. This finishes the rest (any English country name), and
 * picks up addresses an older Bid release wrote to "user_address" between that migration and the
 * switch to the address book. It keeps each address id, never changes an address already copied,
 * and gives a default only to a person who has none of that kind. Addresses whose country cannot
 * be read are listed and left in Bid's table.
 *
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-identity-addresses
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { createDb } from "../client.js";
import { user } from "../schema/auth.js";
import { identityAddress } from "../schema/identity-address.js";
import { userAddress } from "../schema/user-address.js";
import { legacyCountryToIso } from "./legacy-country.js";

const db = createDb(process.env.DATABASE_URL ?? "");

async function main() {
  const missing = await db
    .select({ address: userAddress, name: user.name, email: user.email })
    .from(userAddress)
    .innerJoin(user, eq(user.id, userAddress.userId))
    .leftJoin(identityAddress, eq(identityAddress.id, userAddress.id))
    .where(isNull(identityAddress.id))
    .orderBy(userAddress.createdAt);

  let copied = 0;
  const unreadable: string[] = [];
  for (const { address, name, email } of missing) {
    if (email === `deleted+${address.userId}@purged.invalid`) continue;
    const country = legacyCountryToIso(address.country);
    if (!country) {
      unreadable.push(`${address.id} (${address.userId}): "${address.country}"`);
      continue;
    }
    await db.transaction(async (tx) => {
      const hasDefault = async (column: "isDefaultShipping" | "isDefaultBilling") =>
        (
          await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(identityAddress)
            .where(
              and(eq(identityAddress.subjectId, address.userId), eq(identityAddress[column], true)),
            )
        )[0]?.n;
      await tx
        .insert(identityAddress)
        .values({
          id: address.id,
          subjectId: address.userId,
          label: address.label,
          recipientName: name.trim() || address.label,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          region: address.state,
          postcode: address.postalCode,
          country,
          isDefaultShipping:
            address.isDefault &&
            address.addressType !== "billing" &&
            !(await hasDefault("isDefaultShipping")),
          isDefaultBilling:
            address.isDefault &&
            address.addressType !== "shipping" &&
            !(await hasDefault("isDefaultBilling")),
          createdAt: address.createdAt,
          updatedAt: address.createdAt,
        })
        .onConflictDoNothing();
    });
    copied++;
  }

  console.log(`backfill complete: copied=${copied} unreadable_country=${unreadable.length}`);
  for (const line of unreadable) console.warn(`left in user_address: ${line}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
