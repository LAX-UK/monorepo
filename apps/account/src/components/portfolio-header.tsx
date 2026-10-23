import { formatMinorUnits } from "@/lib/format-money";
import type { PortfolioHeaderVm } from "@auction/lax-ecosystem";
import { KpiTile } from "@auction/ui/components/kpi-tile";

export const PAID_SO_FAR_NOTE =
  "What you've paid across LAX, in the currency you paid. Not a valuation.";

/**
 * Counts of works by state, then what has been paid, one figure per currency. There is no
 * single total on purpose: the businesses and currencies differ, and no valuation exists.
 */
export function PortfolioHeader({ header }: { header: PortfolioHeaderVm }) {
  const counts = [
    { label: "Works owned", value: header.worksOwned },
    { label: "In sale or consigned", value: header.inSaleOrConsigned },
    { label: "Awaiting payment", value: header.awaitingPayment },
  ];
  return (
    <section aria-labelledby="portfolio-summary-heading" className="flex flex-col gap-4">
      <h2 id="portfolio-summary-heading" className="sr-only">
        Summary
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {counts.map(({ label, value }) => (
          <li key={label}>
            <KpiTile label={label} value={value} className="min-h-0" />
          </li>
        ))}
      </ul>
      <div className="rounded-2xl border border-border-hairline bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-medium text-on-surface-variant">Paid so far</h3>
        {header.paidSoFar.length === 0 ? (
          <p className="mt-1 font-headline text-lg text-on-surface">Nothing paid yet</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
            {header.paidSoFar.map((total) => (
              <li
                key={total.currency}
                className="font-headline text-2xl font-semibold tabular-nums text-on-surface"
              >
                {formatMinorUnits(total.amount, total.currency)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-on-surface-variant">{PAID_SO_FAR_NOTE}</p>
      </div>
    </section>
  );
}
