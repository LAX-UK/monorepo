import type { PortfolioAnalyticsVm } from "@/lib/data/view-models/dashboard-portfolio.vm";
import { LabelCaps } from "@auction/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";

type Props = {
  analytics: PortfolioAnalyticsVm;
};

/** Top-of-page summary for the buyer's private collection.
 *
 * Surfaces the three numbers collectors care about — total cost basis,
 * outstanding payments, and how many lots were acquired this year — without
 * making any claims that would require new data sources (e.g. valuations).
 */
export function PortfolioAnalyticsCard({ analytics }: Props) {
  if (analytics.totalRows === 0) return null;
  return (
    <Card
      aria-label="Collection summary"
      className="border-outline-variant/15 bg-surface-container-lowest shadow-sm"
    >
      <CardHeader className="space-y-1.5">
        <LabelCaps className="text-primary">Collection</LabelCaps>
        <div>
          <CardTitle className="font-headline text-xl font-semibold tracking-tight md:text-2xl">
            {analytics.totalRows === 1
              ? "1 acquired work"
              : `${analytics.totalRows} acquired works`}
          </CardTitle>
          <CardDescription>
            Totals reflect hammer + buyer&apos;s premium across your private collection.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-4">
            <dt className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
              Total spent
            </dt>
            <dd className="mt-1 font-headline text-2xl tabular-nums text-on-surface">
              {analytics.totalSpentFormatted}
            </dd>
          </div>
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-4">
            <dt className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
              Outstanding
            </dt>
            <dd className="mt-1 font-headline text-2xl tabular-nums text-on-surface">
              {analytics.outstandingFormatted}
            </dd>
          </div>
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-4">
            <dt className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
              This year
            </dt>
            <dd className="mt-1 font-headline text-2xl tabular-nums text-on-surface">
              {analytics.wonThisYear}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
