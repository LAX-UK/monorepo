/**
 * Brings Pay several refund totals counted under the old rule (a refund counted while pending
 * that then failed) back down to what Stripe reports succeeded. Never runs on its own.
 *
 * Dry run (default), reads Stripe and the database and prints each group whose totals differ;
 * writes nothing:
 *   DATABASE_URL=... STRIPE_SECRET_KEY=... pnpm --filter @auction/api repair:group-refund-totals
 * One group:
 *   ... repair:group-refund-totals -- --group <payment group id>
 * Apply (writes the compensating entries, once):
 *   ... repair:group-refund-totals -- --apply [--group <id>] [--limit <n>]
 *
 * Safe to run again: corrections are measured under each group's lock and written once, so a
 * second run reports nothing left to repair. Only what refunds that failed or were cancelled
 * explain is taken back; anything else above Stripe is printed as UNEXPLAINED for finance.
 * See docs/runbooks/stripe-connect-go-live.md ("Refund totals repair").
 */
import { createDb } from "@auction/db";
import { createGroupRefundRepair } from "../src/container/create-group-refund-repair.js";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const url = process.env.DATABASE_URL;
if (!url || !process.env.STRIPE_SECRET_KEY) {
  console.error("Set DATABASE_URL and STRIPE_SECRET_KEY.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const groupId = argValue("--group");
const limitArg = argValue("--limit");
const service = createGroupRefundRepair(createDb(url), process.env.STRIPE_SECRET_KEY);

const report = await service.run({
  apply,
  ...(groupId ? { groupId } : {}),
  ...(limitArg ? { limit: Number(limitArg) } : {}),
});

console.log(apply ? "APPLY: writing corrections." : "DRY RUN: nothing is written. Add --apply.");
for (const group of report.groups) {
  console.log(
    `group ${group.groupId} charge ${group.stripeChargeId}${group.unexplained ? " UNEXPLAINED" : ""}${group.pendingRefunds > 0 ? ` (${group.pendingRefunds} refund(s) still pending)` : ""}`,
  );
  for (const m of group.members) {
    console.log(
      `  invoice ${m.paymentId}\tbuyer ${m.recordedBuyerPence}p seller ${m.recordedSellerPence}p stripe ${m.succeededPence}p\tcorrection buyer ${m.buyerCorrectionPence}p seller ${m.sellerCorrectionPence}p`,
    );
  }
  for (const d of group.deliveries) {
    console.log(
      `  courier ${d.quoteId}\trecorded ${d.recordedPence}p stripe ${d.succeededPence}p\tcorrection ${d.correctionPence}p`,
    );
  }
  const u = group.unattributed;
  if (u.recordedPence !== u.succeededPence) {
    console.log(
      `  unattributed\trecorded ${u.recordedPence}p stripe ${u.succeededPence}p\tcorrection ${u.correctionPence}p`,
    );
  }
}
console.log(
  `${report.checked} group(s) checked; ${report.groups.length} differ from Stripe; ${report.groups.filter((g) => g.unexplained).length} unexplained.`,
);
process.exit(0);
