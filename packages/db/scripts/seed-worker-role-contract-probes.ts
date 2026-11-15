import { eq, sql } from "drizzle-orm";
/**
 * Idempotent minimal rows for worker_app role contract live probes (CI worker-role-contract job).
 */
import { createDb } from "../src/index.js";
import { user } from "../src/schema/auth.js";
import { bidIdentityDirectory } from "../src/schema/bid-identity-directory.js";
import { bid } from "../src/schema/bids.js";
import { legalEntity } from "../src/schema/legal-entities.js";
import { lot } from "../src/schema/lots.js";

const PROBE_USER_ID = "worker-role-contract-probe-user";
const PROBE_LE_ID = "00000000-0000-4000-8000-000000000001";
const PROBE_LOT_ID = "00000000-0000-4000-8000-000000000002";
const PROBE_BID_ID = "00000000-0000-4000-8000-000000000003";
// Shop rows the accounting facts reader follows from an order or an original sale to its buyer.
const PROBE_SHOP_BUYER_PARTY_ID = "00000000-0000-4000-8000-000000000010";
const PROBE_SHOP_ARTIST_PARTY_ID = "00000000-0000-4000-8000-000000000011";
const PROBE_SHOP_ARTIST_ID = "00000000-0000-4000-8000-000000000012";
const PROBE_SHOP_ARTWORK_ID = "00000000-0000-4000-8000-000000000013";
const PROBE_SHOP_GUEST_ID = "00000000-0000-4000-8000-000000000014";
const PROBE_SHOP_GUEST_ORDER_ID = "00000000-0000-4000-8000-000000000015";
const PROBE_SHOP_USER_ORDER_ID = "00000000-0000-4000-8000-000000000016";
const PROBE_SHOP_ORIGINAL_SALE_ID = "00000000-0000-4000-8000-000000000017";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const db = createDb(url);

  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, PROBE_USER_ID));
  if (existingUser.length === 0) {
    await db.insert(user).values({
      id: PROBE_USER_ID,
      name: "Worker Role Probe",
      email: "worker-role-contract-probe@lax.bid.local",
      emailVerified: true,
      role: "client",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const existingDirectory = await db
    .select({ subjectId: bidIdentityDirectory.subjectId })
    .from(bidIdentityDirectory)
    .where(eq(bidIdentityDirectory.subjectId, PROBE_USER_ID));
  if (existingDirectory.length === 0) {
    const now = new Date();
    await db.insert(bidIdentityDirectory).values({
      subjectId: PROBE_USER_ID,
      email: "worker-role-contract-probe@lax.bid.local",
      name: "Worker Role Probe",
      emailVerified: true,
      identityCreatedAt: now,
      replicatedAt: now,
      lastEventId: 0,
    });
  }

  const existingLe = await db
    .select({ id: legalEntity.id })
    .from(legalEntity)
    .where(eq(legalEntity.id, PROBE_LE_ID));
  if (existingLe.length === 0) {
    await db.insert(legalEntity).values({
      id: PROBE_LE_ID,
      displayName: "Worker Role Probe LE",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: PROBE_USER_ID,
      status: "approved",
    });
  }

  const existingLot = await db.select({ id: lot.id }).from(lot).where(eq(lot.id, PROBE_LOT_ID));
  if (existingLot.length === 0) {
    const now = new Date();
    const end = new Date(now.getTime() + 86_400_000);
    await db.insert(lot).values({
      id: PROBE_LOT_ID,
      sellerLegalEntityId: PROBE_LE_ID,
      title: "Worker role contract probe lot",
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "100.00",
      startTime: now,
      endTime: end,
      status: "draft",
    });
  }

  const existingBid = await db.select({ id: bid.id }).from(bid).where(eq(bid.id, PROBE_BID_ID));
  if (existingBid.length === 0) {
    await db.insert(bid).values({
      id: PROBE_BID_ID,
      lotId: PROBE_LOT_ID,
      bidderId: PROBE_USER_ID,
      subjectId: PROBE_USER_ID,
      buyerLegalEntityId: PROBE_LE_ID,
      amount: "100.00",
      placedVia: "web",
      internalPlacementKey: "worker-role-contract-probe-bid",
    });
  }

  // Paid orders (one a guest's, one an account's) and a paid original sale whose invoice goes to the
  // buyer's account, so the reader's buyer lookups (guest customer, user profile) have rows to read.
  await db.execute(sql`
    INSERT INTO shop_party (id, display_name, identity_subject_id)
    VALUES (${PROBE_SHOP_BUYER_PARTY_ID}, 'Worker Role Probe Buyer', ${PROBE_USER_ID}),
           (${PROBE_SHOP_ARTIST_PARTY_ID}, 'Worker Role Probe Artist', NULL)
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO shop_artist (id, party_id, slug)
    VALUES (${PROBE_SHOP_ARTIST_ID}, ${PROBE_SHOP_ARTIST_PARTY_ID}, 'worker-role-contract-probe')
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO shop_artwork (id, slug, title, artist_id, eligible_for_edition_allocation, import_key)
    VALUES (${PROBE_SHOP_ARTWORK_ID}, 'worker-role-contract-probe', 'Worker role probe work',
            ${PROBE_SHOP_ARTIST_ID}, false, 'worker-role-contract-probe')
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO shop_guest_customer (id, email)
    VALUES (${PROBE_SHOP_GUEST_ID}, 'worker-role-contract-guest@lax.bid.local')
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO shop_user_profile (identity_subject_id, email, name)
    VALUES (${PROBE_USER_ID}, 'worker-role-contract-probe@lax.bid.local', 'Worker Role Probe')
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO shop_order (id, identity_subject_id, status, fulfilment, merchandise_subtotal_pence,
      fulfilment_surcharge_pence, total_pence, idempotency_key, buyer_party_id, guest_customer_id, paid_at)
    VALUES (${PROBE_SHOP_GUEST_ORDER_ID}, 'guest:worker-role-contract', 'paid', 'uk_insured_delivery',
            100, 0, 100, 'worker-role-contract-guest-order', ${PROBE_SHOP_BUYER_PARTY_ID},
            ${PROBE_SHOP_GUEST_ID}, now()),
           (${PROBE_SHOP_USER_ORDER_ID}, ${PROBE_USER_ID}, 'paid', 'uk_insured_delivery',
            100, 0, 100, 'worker-role-contract-user-order', ${PROBE_SHOP_BUYER_PARTY_ID}, NULL, now())
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO shop_original_sale (id, artwork_id, buyer_party_id, status, sale_price_pence,
      recorded_by_subject_id, invoice_issuer, invoice_number, paid_at)
    VALUES (${PROBE_SHOP_ORIGINAL_SALE_ID}, ${PROBE_SHOP_ARTWORK_ID}, ${PROBE_SHOP_BUYER_PARTY_ID},
            'paid', 100, ${PROBE_USER_ID}, 'books', 'LAX-INV-999001', now())
    ON CONFLICT DO NOTHING`);

  console.log("worker role contract probes seeded");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
