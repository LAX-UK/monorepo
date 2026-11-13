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
 * release; see docs/runbooks/buyer-premium-tiers.md): the migration's change to lot rates is
 * applied first, then it flags every lot open for bidding, or sold but not yet invoiced, that the
 * release would charge under a different premium than the old code did, and every lot in a sale
 * with bands (invoiced too) that would still hold a rate differing from the bands. Staff cannot
 * change these lots, so any flagged lot blocks the deploy. Without `--pre-deploy` the database is
 * read as it stands.
 *
 * Performs only SELECTs. The exit status comes from `premiumCheckExitCode`: 1 if any lot is
 * flagged; without `--pre-deploy`, also if any unsold lot that has not opened has its own premium
 * that differs from its sale's (the sale page lists these for staff; marked ⚠).
 */
import { createDb } from "@auction/db";
import { bidInvoice, bidInvoiceLine, lot as lotTable, sale as saleTable } from "@auction/db/schema";
import {
  addMoneyStrings,
  describeBuyerPremium,
  resolveBuyerPremium,
  saleBuyerPremiumSchedule,
} from "@auction/validators";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  checkPremiumLot,
  premiumCheckExitCode,
  saleWithoutBandsNotice,
} from "../src/lib/buyer-premium-deploy-check.js";

const saleArg = process.argv.find((a) => a.startsWith("--sale="))?.slice("--sale=".length);
const preDeploy = process.argv.includes("--pre-deploy");

const db = createDb(process.env.DATABASE_URL ?? "");

const POUNDS = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const gbp = (major: string) => `£${POUNDS.format(Number.parseFloat(major))}`;

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

const totals = { changed: 0, differsFromSale: 0, bandedOverride: 0 };
let totalLots = 0;
let legacyTotals = 0;

for (const sale of sales) {
  console.log(
    `\n=== Sale ${sale.title} [${sale.id}] status=${sale.status} mode=${sale.deliveryMode} ===`,
  );
  console.log(`  sale premium: ${describeBuyerPremium(saleBuyerPremiumSchedule(sale).schedule)}`);
  const noBands = saleWithoutBandsNotice(sale);
  if (noBands) console.log(`  ⓘ ${noBands}`);

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

  // Each lot's live invoice, and whether it itemises the hammer (a legacy one holds one total).
  const invoiced = new Map(
    (
      await db
        .select({
          lotId: bidInvoice.lotId,
          itemisesHammer: sql<boolean>`coalesce(bool_or(${bidInvoiceLine.kind} = 'hammer'), false)`,
        })
        .from(bidInvoice)
        .leftJoin(bidInvoiceLine, eq(bidInvoiceLine.invoiceId, bidInvoice.id))
        .where(
          and(
            inArray(
              bidInvoice.lotId,
              lots.map((l) => l.id),
            ),
            isNull(bidInvoice.voidedAt),
          ),
        )
        .groupBy(bidInvoice.id)
    ).map((row) => [row.lotId, row.itemisesHammer] as const),
  );

  for (const lot of lots) {
    totalLots += 1;
    const label = `Lot #${lot.lotNumber ?? "-"} ${lot.title.slice(0, 40)} [${lot.status}]`;
    const hasLiveInvoice = invoiced.has(lot.id);
    const check = checkPremiumLot(
      {
        status: lot.status,
        hasWinner: lot.winnerId !== null,
        hasLiveInvoice,
        invoiceItemisesHammer: invoiced.get(lot.id),
        lotRate: lot.buyerPremiumRate,
      },
      sale,
      { preDeploy },
    );
    if (check.changed) totals.changed += 1;
    if (check.differsFromSale) totals.differsFromSale += 1;
    if (check.bandedOverride) totals.bandedOverride += 1;
    if (check.legacyTotalInvoice) legacyTotals += 1;
    const override = check.bandedOverride
      ? `✖ keeps its own ${check.lotRate} in a sale with bands: re-priced at it if its invoice is voided | `
      : "";
    if (hasLiveInvoice) {
      const shows = check.legacyTotalInvoice
        ? `invoiced (legacy single total): charges its stored invoice; public pages show premium ${describeBuyerPremium(resolveBuyerPremium({ lotRate: check.lotRate, sale }).schedule)}`
        : "invoiced: shows and charges its stored invoice";
      console.log(`  ${override || "  "}${label} | ${shows}`);
      continue;
    }
    const { policy, source } = resolveBuyerPremium({ lotRate: check.lotRate, sale });
    const hammer = lot.currentPrice;
    const premium = policy.computePremiumMajor(hammer);
    const kind = source === "lot" ? `lot's own ${check.lotRate}` : source;
    const flag = check.changed
      ? `✖ ${check.changed}: premium changes at deploy | `
      : override ||
        (check.differsFromSale ? "⚠ " : check.noLegacyRate ? "ⓘ no legacy rate | " : "  ");
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
  totals.changed > 0
    ? `✖ ${totals.changed} live or sold-but-not-invoiced lot(s) would be charged a different premium than before. Do not deploy.`
    : "No live or sold-but-not-invoiced lot changes premium.",
);
if (preDeploy) {
  console.log(
    totals.bandedOverride > 0
      ? `✖ ${totals.bandedOverride} lot(s) in a sale with bands would still hold a rate differing from the bands. Do not deploy.`
      : "No lot in a sale with bands keeps a rate of its own.",
  );
}
console.log(
  totals.differsFromSale > 0
    ? `⚠ ${totals.differsFromSale} unsold lot(s) have their own premium that differs from their sale's — check the sale page${preDeploy ? " (does not block the deploy)" : ""}.`
    : "Every unsold lot charges its sale's premium, or its own premium equals it.",
);

if (legacyTotals > 0) {
  console.log(
    `ⓘ ${legacyTotals} invoiced lot(s) have a legacy single-total invoice: public pages show today's premium for them (does not block).`,
  );
}

process.exit(premiumCheckExitCode(totals, { preDeploy }));
