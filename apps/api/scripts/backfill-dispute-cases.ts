/**
 * Creates dispute cases for disputes recorded only as domain events (before dispute cases existed),
 * so finance sees them on the Disputes screen.
 *
 * Dry run (default), prints what would be created and writes nothing:
 *   DATABASE_URL=... pnpm --filter @auction/api backfill:dispute-cases
 * Apply:
 *   DATABASE_URL=... pnpm --filter @auction/api backfill:dispute-cases -- --apply
 *
 * Safe to run again: a dispute that already has a case is skipped.
 */
import { createDb } from "@auction/db";
import { FIELDS_ONLY_STRIPE_KNOWS } from "../src/services/disputes/dispute-case-backfill.js";
import { backfillDisputeCases } from "../src/services/disputes/dispute-case-backfill.runner.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const report = await backfillDisputeCases(createDb(url), { apply });
const { plan } = report;

console.log(apply ? "APPLY: writing dispute cases." : "DRY RUN: nothing is written. Add --apply.");
for (const planned of plan.cases) {
  console.log(
    `${planned.stripeDisputeId}\t${planned.status}\t${planned.amountPence / 100} ${planned.currency}\t${planned.allocationState}\t${planned.candidatePaymentIds.length} invoice(s)`,
  );
}
for (const skipped of plan.skipped) {
  console.log(`${skipped.stripeDisputeId}\tskipped: ${skipped.reason}`);
}
const unmatched = plan.cases.filter((c) => c.allocationState === "needs_allocation").length;
console.log(
  `${plan.cases.length} case(s) ${apply ? `planned, ${report.created} created` : "would be created"}; ${unmatched} need allocation; ${plan.skipped.length} skipped.`,
);
console.log("Left empty because only Stripe knows them:");
for (const field of FIELDS_ONLY_STRIPE_KNOWS) console.log(`  - ${field}`);
