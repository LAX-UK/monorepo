import type { AdminPayoutListSummary } from "@/lib/data/http/admin-payouts.shared";

type Props = {
  summary: AdminPayoutListSummary;
};

export function PayoutSettlementReadinessBand({ summary }: Props) {
  const { readiness } = summary;

  return (
    <section
      aria-labelledby="payout-settlement-readiness-heading"
      className="overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]"
    >
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <h2
            id="payout-settlement-readiness-heading"
            className="font-heading text-lg text-on-surface"
          >
            Settlement readiness
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Snapshot across all payouts matching the current filters.
          </p>
        </div>
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">In flight (scheduled + in transit)</span>
            <p className="text-lg font-semibold tabular-nums">{readiness.inFlightCount}</p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Missing Stripe transfer ID</span>
            <p className="text-lg font-semibold tabular-nums">
              {readiness.missingTransferRefCount}
            </p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Payouts with blockers</span>
            <p className="text-lg font-semibold tabular-nums">{readiness.blockerPayoutCount}</p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Stripe failure reason</span>
            <p className="text-lg font-semibold tabular-nums">{readiness.withFailureReasonCount}</p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Statement PDF errors</span>
            <p className="text-lg font-semibold tabular-nums">
              {readiness.withStatementErrorCount}
            </p>
          </li>
          <li className="rounded-md bg-surface-container-low px-3 py-2">
            <span className="text-on-surface-variant">Failed / reversed / clawback</span>
            <p className="text-lg font-semibold tabular-nums">
              {readiness.failedCount} / {readiness.reversedCount} / {readiness.clawbackCount}
            </p>
          </li>
        </ul>
      </div>
    </section>
  );
}
