/**
 * READ-ONLY pre-launch check: prints the buyer's premium that checkout will actually charge for
 * every lot in upcoming/active sales, using the SAME resolver as the money path
 * (`buildBuyerPremiumPolicy` → `PaymentService.totalDuePence`). Use it to confirm the premium
 * amount is correct (e.g. tiered 15%/10%) before opening a sale — checkout uses
 * `sale.buyerPremiumTiers` if set, otherwise `lot.buyerPremiumRate` (DB default 0.25 = 25%);
 * `sale.buyerPremiumRate` is NOT used by checkout.
 *
 * Run:
 *   pnpm --filter @auction/api exec tsx scripts/verify-buyer-premium-config.ts
 *   pnpm --filter @auction/api exec tsx scripts/verify-buyer-premium-config.ts --sale=<saleId>
 *
 * Performs only SELECTs. Exit code 1 if any lot looks misconfigured (flat 25% default on a lot
 * whose sale has no tiers), so it can gate a deploy/check step.
 */
import { createDb } from "@auction/db";
import { lot as lotTable, sale as saleTable } from "@auction/db/schema";
import { buildBuyerPremiumPolicy } from "@auction/validators";
import { and, eq, inArray, isNull } from "drizzle-orm";

const saleArg = process.argv.find((a) => a.startsWith("--sale="))?.slice("--sale=".length);

const db = createDb(process.env.DATABASE_URL ?? "");

const gbp = (major: string) =>
  `£${Number.parseFloat(major).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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
    `  sale.buyerPremiumRate=${sale.buyerPremiumRate} (display only) · tiers=${
      tiersActive ? JSON.stringify(tiers) : "none"
    }`,
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
    const policy = buildBuyerPremiumPolicy({
      saleTiers: tiers,
      lotRate: lot.buyerPremiumRate,
    });
    const hammer = lot.currentPrice;
    const premium = policy.computePremiumMajor(hammer);
    const total = (Number.parseFloat(hammer) + Number.parseFloat(premium)).toFixed(2);
    const kind = policy.id.startsWith("tiered:") ? "tiered" : "flat";
    const suspect =
      kind === "flat" && Number.parseFloat(lot.buyerPremiumRate) === 0.25 && !tiersActive;
    if (suspect) misconfigured += 1;
    console.log(
      `  ${suspect ? "⚠ " : "  "}Lot #${lot.lotNumber ?? "-"} ${lot.title.slice(0, 40)} | ` +
        `hammer ${gbp(hammer)} | premium ${gbp(premium)} (${kind}, lotRate=${lot.buyerPremiumRate}) | ` +
        `total ${gbp(total)}`,
    );
  }
}

console.log(
  `\nChecked ${totalLots} lot(s) across ${sales.length} sale(s). ${
    misconfigured > 0
      ? `⚠ ${misconfigured} lot(s) use the flat 25% default with no sale tiers — confirm this is intended.`
      : "No 25%-default-without-tiers lots found."
  }`,
);

process.exit(misconfigured > 0 ? 1 : 0);
