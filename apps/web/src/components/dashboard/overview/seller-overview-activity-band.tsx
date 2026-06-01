import { DashboardEmptyState } from "@/components/dashboard/primitives";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { formatMoney } from "@/lib/format-currency";
import { Surface } from "@auction/ui/components/surface";
import { ArrowRight, CalendarDays, WalletCards } from "lucide-react";
import Link from "next/link";

export type SellerUpcomingSaleRow = {
  saleId: string;
  saleTitle: string;
  scheduleIso: string;
  scheduleLabel: string;
  lotsInSale: number;
};

export type SellerPayoutForecast = {
  reservedFloor: string;
  bestCaseHammer: string;
  lotsWithReserve: number;
  liveLots: number;
};

type Props = {
  upcomingSales: SellerUpcomingSaleRow[];
  forecast: SellerPayoutForecast;
};

export function SellerOverviewActivityBand({ upcomingSales, forecast }: Props) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Surface variant="quiet" padding="md" className="space-y-4">
        <header className="flex items-center gap-3">
          <CalendarDays className="size-5 text-primary" aria-hidden />
          <h2 className="font-headline text-lg font-semibold text-on-surface">Upcoming sales</h2>
        </header>
        {upcomingSales.length === 0 ? (
          <DashboardEmptyState
            variant="quiet"
            title="No upcoming sales"
            description="Once specialists assign your work to a sale, it will appear here."
            headingLevel="h3"
          />
        ) : (
          <ul className="divide-y divide-border-hairline">
            {upcomingSales.map((row) => (
              <li key={row.saleId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={DASHBOARD_ROUTES.sellerInSale}
                    className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {row.saleTitle}
                  </Link>
                  <p className="text-xs text-on-surface-variant dark:text-on-surface-variant">
                    {row.lotsInSale} of your lot
                    {row.lotsInSale === 1 ? "" : "s"} · first close{" "}
                    <time dateTime={row.scheduleIso}>{row.scheduleLabel}</time>
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
              </li>
            ))}
          </ul>
        )}
      </Surface>
      <Surface variant="quiet" padding="md" className="space-y-4">
        <header className="flex items-center gap-3">
          <WalletCards className="size-5 text-primary" aria-hidden />
          <h2 className="font-headline text-lg font-semibold text-on-surface">Payout forecast</h2>
        </header>
        {forecast.liveLots === 0 ? (
          <p className="font-body text-sm text-on-surface-variant dark:text-on-surface-variant">
            No live lots right now. The forecast updates once your submissions are scheduled into a
            sale.
          </p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Reserved floor
              </dt>
              <dd className="mt-1 break-words font-headline text-xl tabular-nums text-primary">
                {formatMoney(forecast.reservedFloor)}
              </dd>
              <p className="mt-1 text-xs text-on-surface-variant dark:text-on-surface-variant">
                Hammer floor if every reserved lot just meets reserve.
              </p>
            </div>
            <div className="min-w-0">
              <dt className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Current best case
              </dt>
              <dd className="mt-1 break-words font-headline text-xl tabular-nums text-primary">
                {formatMoney(forecast.bestCaseHammer)}
              </dd>
              <p className="mt-1 text-xs text-on-surface-variant dark:text-on-surface-variant">
                Sum of current prices across {forecast.liveLots} live/scheduled lot
                {forecast.liveLots === 1 ? "" : "s"} · {forecast.lotsWithReserve} reserved.
              </p>
            </div>
          </dl>
        )}
        <p className="font-body text-xs text-on-surface-variant dark:text-on-surface-variant">
          Indicative only. Final payouts subtract platform fees, VAT, and Stripe transfer charges —
          see{" "}
          <Link
            href={DASHBOARD_ROUTES.sellerPayouts}
            className="underline underline-offset-2 hover:text-on-surface"
          >
            Sold &amp; payouts
          </Link>
          .
        </p>
      </Surface>
    </section>
  );
}
