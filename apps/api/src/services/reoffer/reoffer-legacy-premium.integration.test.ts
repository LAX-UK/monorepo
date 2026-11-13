import { randomUUID } from "node:crypto";
import { type Database, createDbFromPool } from "@auction/db";
import {
  readJournalMigrations,
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "@auction/db/migrate-runner";
import { claimableShortfall } from "@auction/domain";
import { InvoiceRaiser } from "@auction/finance-runtime";
import {
  DrizzleBidInvoiceRepository,
  DrizzleBuyerDefaultRepository,
  DrizzleLotRepository,
  DrizzleSaleRepository,
} from "@auction/persistence/repositories";
import { standardBuyerPremiumBands } from "@auction/validators";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { heldSellerTerms } from "../../testing/seller-terms.js";
import { buyersPremiumMinorOf, invoiceReofferPricing } from "./reoffer-invoice-pricing.js";

const adminUrl = process.env.MIGRATION_TEST_DATABASE_URL;

/** £600,000 under the standard bands: 15% of £500,000 + 10% of £100,000. */
const HAMMER = 60_000_000;
const BANDED_PREMIUM = 8_500_000;
const BANDS_LABEL = "Buyer's premium (15% of £500,000 + 10% of £100,000)";

/**
 * A lot invoiced before the clause 11 release, in a sale with bands, still holds the old 25%
 * default the old code never read. Migration 0380 clears it, so when the buyer defaults and the
 * invoice is voided, everything priced afresh charges the bands the buyer was invoiced on: the
 * re-offer price, the re-raised invoice and the premium the defaulting buyer is claimed for.
 *
 * Runs on its own database: the lineage up to the migration before 0380, rows as the old release
 * left them, then 0380 itself.
 */
describe.skipIf(!adminUrl)("a legacy-invoiced lot after a buyer default (integration)", () => {
  const databaseName = `auction_h2_${randomUUID().replaceAll("-", "")}`;
  let admin: pg.Client;
  let pool: pg.Pool;
  let db: Database;

  const lotId = randomUUID();
  const buyerUserId = `h2-buyer-${randomUUID().slice(0, 8)}`;
  const secondUserId = `h2-second-${randomUUID().slice(0, 8)}`;
  const buyerId = randomUUID();
  const secondId = randomUUID();
  const sellerId = randomUUID();
  const saleId = randomUUID();

  beforeAll(async () => {
    if (!adminUrl) return;
    const server = new URL(adminUrl);
    server.pathname = "/postgres";
    admin = new pg.Client({ connectionString: server.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const target = new URL(adminUrl);
    target.pathname = `/${databaseName}`;
    pool = new pg.Pool({ connectionString: target.toString() });

    const migrations = readJournalMigrations();
    const index = migrations.findIndex((m) =>
      m.sql.some((statement) => statement.includes("lot_premium_rate_before_0380")),
    );
    const before = migrations[index - 1];
    if (index < 1 || !before) throw new Error("Migration 0380 not found in the journal");
    await runMigrationsPerTransactionThrough(pool, before.folderMillis);

    // As the old release left them: the lot holds the old 25% default, its invoice was raised
    // on the sale's bands (the old code never read the lot's rate in a sale with bands).
    for (const id of [buyerUserId, secondUserId]) {
      await pool.query(
        `insert into "user" (id, name, email, created_at, updated_at)
         values ($1, $1, $2, now(), now())`,
        [id, `${id}@integration.test`],
      );
    }
    for (const [id, name] of [
      [buyerId, "Buyer"],
      [secondId, "Underbidder"],
      [sellerId, "Seller"],
    ] as const) {
      await pool.query(
        `insert into legal_entity (id, kind, subkind, display_name, created_by_user_id, status)
         values ($1, 'individual', 'private_collector', $2, $3, 'approved')`,
        [id, `${name} ${id.slice(0, 4)}`, buyerUserId],
      );
    }
    await pool.query(
      `insert into sale (id, title, status, start_time, end_time, created_by_legal_entity_id,
         buyer_premium_rate, buyer_premium_tiers)
       values ($1, 'Banded sale', 'ended', now() - interval '3 days', now() - interval '1 day',
         $2, 0.25, $3)`,
      [saleId, sellerId, JSON.stringify(standardBuyerPremiumBands())],
    );
    await pool.query(
      `insert into lot (id, sale_id, title, auction_type, starting_price, current_price,
         start_time, end_time, status, winner_id, buyer_legal_entity_id, seller_legal_entity_id,
         buyer_premium_rate)
       values ($1, $2, 'Legacy lot', 'english', 10, 600000, now() - interval '3 days',
         now() - interval '1 day', 'ended', $3, $4, $5, 0.2500)`,
      [lotId, saleId, buyerUserId, buyerId, sellerId],
    );
    await pool.query(
      `insert into bid_invoice (lot_id, buyer_legal_entity_id, seller_legal_entity_id,
         total_pence, raised_at, due_at)
       values ($1, $2, $3, $4, now() - interval '1 day', now() + interval '6 days')`,
      [lotId, buyerId, sellerId, HAMMER + BANDED_PREMIUM],
    );

    await runMigrationsPerTransaction(pool);
    db = createDbFromPool(pool);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    if (!admin) return;
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.end();
  });

  const services = () => {
    const lots = new DrizzleLotRepository(db);
    const invoiceRaiser = new InvoiceRaiser({
      invoices: new DrizzleBidInvoiceRepository(db),
      sales: new DrizzleSaleRepository(db),
    });
    return { lots, invoiceRaiser, pricing: invoiceReofferPricing({ lots, invoiceRaiser }) };
  };

  it("prices the re-offer, the re-raised invoice and the shortfall on the bands", async () => {
    const { lots, invoiceRaiser, pricing } = services();
    expect((await lots.findById(lotId))?.buyerPremiumRate).toBeNull();

    // The buyer defaults: the invoice is voided so the lot can be invoiced afresh.
    await db.transaction((tx) =>
      new DrizzleBuyerDefaultRepository(db).record(tx as unknown as Database, {
        lotId,
        buyerId: buyerUserId,
        buyerLegalEntityId: buyerId,
        sellerLegalEntityId: sellerId,
        paymentId: null,
        hammerPrice: "600000.00",
        wonAt: new Date(Date.now() - 86_400_000),
        reason: "No payment",
        outcome: "offered_to_underbidder",
        buyerRestricted: false,
        actorUserId: buyerUserId,
      }),
    );
    const live = await pool.query(
      "select 1 from bid_invoice where lot_id = $1 and voided_at is null",
      [lotId],
    );
    expect(live.rowCount).toBe(0);

    // The re-offer the underbidder sees and accepts, at £600,000.
    const offer = await pricing.priceFor({
      lotId,
      buyerLegalEntityId: secondId,
      hammerPence: HAMMER,
    });
    const offerPremium = offer.lines.filter((l) => l.kind === "buyers_premium");
    expect(offerPremium.map((l) => l.amountPence)).toEqual([BANDED_PREMIUM]);
    expect(offer.totalPence).toBe(HAMMER + BANDED_PREMIUM);

    // The premium the defaulting buyer is claimed for.
    const originalPremiumMinor = await buyersPremiumMinorOf(pricing, {
      lotId,
      buyerLegalEntityId: buyerId,
      hammerPence: HAMMER,
    });
    expect(
      claimableShortfall({
        originalHammerMinor: HAMMER,
        newHammerMinor: HAMMER,
        originalPremiumMinor,
      }).premiumLostMinor,
    ).toBe(BANDED_PREMIUM);

    // Re-awarded to the underbidder, the invoice raised afresh.
    await pool.query("update lot set winner_id = $2, buyer_legal_entity_id = $3 where id = $1", [
      lotId,
      secondUserId,
      secondId,
    ]);
    const lot = await lots.findById(lotId);
    if (!lot) throw new Error("lot not seeded");
    const priced = await invoiceRaiser.price(lot);
    expect(priced.existing).toBeNull();
    const { invoice } = await invoiceRaiser.raise({
      lot,
      priced,
      sellerTerms: heldSellerTerms(lotId, sellerId),
      payment: {
        lotId,
        paidByUserId: secondUserId,
        buyerLegalEntityId: secondId,
        sellerLegalEntityId: sellerId,
        platformFee: "0.00",
        stripePaymentIntentId: null,
      },
    });
    const premium = invoice.lines.find((line) => line.kind === "buyers_premium");
    expect(premium).toMatchObject({ amountPence: BANDED_PREMIUM, label: BANDS_LABEL });
    expect(invoice.totalPence).toBe(HAMMER + BANDED_PREMIUM);
  });
});
