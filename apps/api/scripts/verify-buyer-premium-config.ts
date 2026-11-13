/**
 * READ-ONLY pre-launch check: prints the buyer's premium that checkout will actually charge for
 * every lot in upcoming/active sales, using the SAME resolver as the money path
 * (`resolveBuyerPremium` → `buildInvoiceLines`): the lot's own premium if staff set one, else the
 * sale's bands (charged slice by slice), else the sale's flat rate.
 *
 * Run:
 *   pnpm --filter @auction/api exec tsx scripts/verify-buyer-premium-config.ts
 *   pnpm --filter @auction/api exec tsx scripts/verify-buyer-premium-config.ts --sale=<saleId>
 *
 * Performs only SELECTs. Exit code 1 if any lot has its own premium that differs from its sale's
 * (the sale page lists these for staff), so it can gate a deploy/check step.
 */
import { createDb } from "@auction/db";
import { lot as lotTable, sale as saleTable } from "@auction/db/schema";
import {
  addMoneyStrings,
  describeBuyerPremium,
  lotPremiumDiffersFromSale,
  resolveBuyerPremium,
} from "@auction/validators";
import { and, eq, inArray, isNull } from "drizzle-orm";

const saleArg = process.argv.find((a) => a.startsWith("--sale="))?.slice("--sale=".length);

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
          inArray(saleTable.status, ["draft", "scheduled", "active"]),
        ),
  );

if (sales.length === 0) {
  console.log("No matching sales (draft/scheduled/active). Pass --sale=<id> to target one.");
  process.exit(0);
}

let misconfigured = 0;
let totalLots = 0;

for (const sale of sales) {
  const tiers = sale.buyerPremiumTiers ?? null;
  const tiersActive = Array.isArray(tiers) && tiers.length > 0;
  console.log(
    `\n=== Sale ${sale.title} [${sale.id}] status=${sale.status} mode=${sale.deliveryMode} ===`,
  );
  console.log(
    `  sale premium: ${describeBuyerPremium(
      tiersActive && tiers
        ? { kind: "bands", bands: tiers }
        : { kind: "flat", rate: sale.buyerPremiumRate },
    )}`,
  );

  const lots = await db
    .select({
      id: lotTable.id,
      lotNumber: lotTable.lotNumber,
      title: lotTable.title,
      status: lotTable.status,
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

  for (const lot of lots) {
    totalLots += 1;
    const { policy, source } = resolveBuyerPremium({ lotRate: lot.buyerPremiumRate, sale });
    const hammer = lot.currentPrice;
    const premium = policy.computePremiumMajor(hammer);
    const total = addMoneyStrings(hammer, premium);
    const kind = source === "lot" ? `lot's own ${lot.buyerPremiumRate}` : source;
    const suspect = lotPremiumDiffersFromSale(lot.buyerPremiumRate, sale);
    if (suspect) misconfigured += 1;
    console.log(
      `  ${suspect ? "⚠ " : "  "}Lot #${lot.lotNumber ?? "-"} ${lot.title.slice(0, 40)} | ` +
        `hammer ${gbp(hammer)} | premium ${gbp(premium)} (${kind}) | ` +
        `total ${gbp(total)}`,
    );
  }
}

console.log(
  `\nChecked ${totalLots} lot(s) across ${sales.length} sale(s). ${
    misconfigured > 0
      ? `⚠ ${misconfigured} lot(s) have their own premium that differs from their sale's — check the sale page.`
      : "Every lot charges its sale's premium, or its own premium equals it."
  }`,
);

process.exit(misconfigured > 0 ? 1 : 0);
