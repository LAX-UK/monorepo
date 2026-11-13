/**
 * READ-ONLY buyer's premium check: prints the premium checkout will charge for every lot in
 * draft, scheduled, active and ended sales, using the SAME resolver as the money path
 * (`resolveBuyerPremium` → `buildInvoiceLines`): the lot's own premium if staff set one, else the
 * sale's bands (charged slice by slice), else the sale's flat rate. Lots with a live invoice are
 * listed as invoiced: every surface reads their stored invoice.
 *
 * Run:
 *   pnpm --filter @auction/api exec tsx scripts/verify-buyer-premium-config.ts
 *   pnpm --filter @auction/api exec tsx scripts/verify-buyer-premium-config.ts --sale=<saleId>
 *   pnpm --filter @auction/api exec tsx scripts/verify-buyer-premium-config.ts --pre-deploy
 *
 * PRE-DEPLOY CHECK for migration 0380 (run with `--pre-deploy` against production before the
 * release; see docs/runbooks/buyer-premium-tiers.md): flags every lot open for bidding, or sold
 * but not yet invoiced, that the release would charge under a different premium than the old
 * code did (the migration's change to lot rates is applied first). Staff cannot change these
 * lots, so any flagged lot blocks the deploy. Without `--pre-deploy` the database is read as it
 * stands.
 *
 * Performs only SELECTs. Exit code 1 if any lot is flagged, or any unsold lot that has not opened
 * has its own premium that differs from its sale's (the sale page lists these for staff).
 */
import { createDb } from "@auction/db";
import { bidInvoice, lot as lotTable, sale as saleTable } from "@auction/db/schema";
import {
  addMoneyStrings,
  describeBuyerPremium,
  lotPremiumDiffersFromSale,
  resolveBuyerPremium,
  saleBuyerPremiumSchedule,
} from "@auction/validators";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  lotRateAfterMigration0380,
  premiumChangedAtDeploy,
} from "../src/lib/buyer-premium-deploy-check.js";

const saleArg = process.argv.find((a) => a.startsWith("--sale="))?.slice("--sale=".length);
const preDeploy = process.argv.includes("--pre-deploy");

const db = createDb(process.env.DATABASE_URL ?? "");

const POUNDS = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const gbp = (major: string) => `£${POUNDS.format(Number.parseFloat(major))}`;
const UNOPENED = new Set(["draft", "scheduled"]);

const sales = await db
  .select({
    id: saleTable.id,
    title: saleTable.title,
    status: saleTable.status,
    deliveryMode: saleTable.deliveryMode,
    buyerPremiumRate: saleTable.buyerPremiumRate,
    buyerPremiumTiers: saleTable.buyerPremiumTiers,
  })
  .from(saleTable)
  .where(
    saleArg
      ? eq(saleTable.id, saleArg)
      : and(
          isNull(saleTable.deletedAt),
          inArray(saleTable.status, ["draft", "scheduled", "active", "ended"]),
        ),
  );

if (sales.length === 0) {
  console.log("No matching sales (draft/scheduled/active/ended). Pass --sale=<id> to target one.");
  process.exit(0);
}

let misconfigured = 0;
let repriced = 0;
let totalLots = 0;

for (const sale of sales) {
  console.log(
    `\n=== Sale ${sale.title} [${sale.id}] status=${sale.status} mode=${sale.deliveryMode} ===`,
  );
  console.log(`  sale premium: ${describeBuyerPremium(saleBuyerPremiumSchedule(sale).schedule)}`);

  const lots = await db
    .select({
      id: lotTable.id,
      lotNumber: lotTable.lotNumber,
      title: lotTable.title,
      status: lotTable.status,
      winnerId: lotTable.winnerId,
      currentPrice: lotTable.currentPrice,
      buyerPremiumRate: lotTable.buyerPremiumRate,
    })
    .from(lotTable)
    .where(and(eq(lotTable.saleId, sale.id), isNull(lotTable.deletedAt)))
    .orderBy(lotTable.lotNumber);

  if (lots.length === 0) {
    console.log("  (no lots attached to this sale)");
    continue;
  }

  const invoiced = new Set(
    (
      await db
        .select({ lotId: bidInvoice.lotId })
        .from(bidInvoice)
        .where(
          and(
            inArray(
              bidInvoice.lotId,
              lots.map((l) => l.id),
            ),
            isNull(bidInvoice.voidedAt),
          ),
        )
    ).map((row) => row.lotId),
  );

  for (const lot of lots) {
    totalLots += 1;
    const label = `Lot #${lot.lotNumber ?? "-"} ${lot.title.slice(0, 40)} [${lot.status}]`;
    if (invoiced.has(lot.id)) {
      console.log(`    ${label} | invoiced: shows and charges its stored invoice`);
      continue;
    }
    const changed = premiumChangedAtDeploy(
      {
        status: lot.status,
        hasWinner: lot.winnerId !== null,
        hasLiveInvoice: false,
        lotRate: lot.buyerPremiumRate,
      },
      sale,
      { preDeploy },
    );
    const differs =
      UNOPENED.has(lot.status) &&
      lot.winnerId === null &&
      lotPremiumDiffersFromSale(lot.buyerPremiumRate, sale);
    if (changed) repriced += 1;
    if (differs) misconfigured += 1;
    const lotRate = preDeploy
      ? lotRateAfterMigration0380({ lotRate: lot.buyerPremiumRate, hasLiveInvoice: false }, sale)
      : lot.buyerPremiumRate;
    const { policy, source } = resolveBuyerPremium({ lotRate, sale });
    const hammer = lot.currentPrice;
    const premium = policy.computePremiumMajor(hammer);
    const kind = source === "lot" ? `lot's own ${lotRate}` : source;
    const flag = changed ? `✖ ${changed}: premium changes at deploy | ` : differs ? "⚠ " : "  ";
    console.log(
      `  ${flag}${label} | hammer ${gbp(hammer)} | premium ${gbp(premium)} (${kind}) | ` +
        `total ${gbp(addMoneyStrings(hammer, premium))}`,
    );
  }
}

console.log(
  `\nChecked ${totalLots} lot(s) across ${sales.length} sale(s)${preDeploy ? ", with migration 0380 applied" : ""}.`,
);
console.log(
  repriced > 0
    ? `✖ ${repriced} live or sold-but-not-invoiced lot(s) would be charged a different premium than before. Do not deploy.`
    : "No live or sold-but-not-invoiced lot changes premium.",
);
console.log(
  misconfigured > 0
    ? `⚠ ${misconfigured} unsold lot(s) have their own premium that differs from their sale's — check the sale page.`
    : "Every unsold lot charges its sale's premium, or its own premium equals it.",
);

process.exit(repriced > 0 || misconfigured > 0 ? 1 : 0);
