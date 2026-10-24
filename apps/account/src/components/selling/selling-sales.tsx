import { Button } from "@/components/account-button";
import { AccountSection, EMPTY_STATE } from "@/components/account-ui";
import { FilterToolbar } from "@/components/filter-toolbar.client";
import { PORTFOLIO_ROUTES } from "@/server/domain/portfolio-routes";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import {
  SALES_PERIODS,
  SALES_PERIOD_LABELS,
  type SaleRowVm,
  type SalesPageVm,
} from "@/server/domain/selling/selling-sales.vm";
import { EmptyState } from "@auction/ui/components/empty-state";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@auction/ui/components/table";
import { MONEY, SellingStat, SellingStats, SellingStatus, formatPence } from "./selling-parts";

function SalesTable({ rows }: { rows: SaleRowVm[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableCaption className="sr-only">
          Each edition you sold, newest first, with what LAX pays you for it.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Artwork</TableHead>
            <TableHead scope="col">Sold</TableHead>
            <TableHead scope="col" className="text-right">
              Sale price
            </TableHead>
            <TableHead scope="col" className="text-right">
              LAX fees
            </TableHead>
            <TableHead scope="col" className="text-right">
              Net to you
            </TableHead>
            <TableHead scope="col">Payout</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.saleId}>
              <TableCell>
                <span className="block font-medium text-on-surface">{row.title}</span>
                {row.edition ? (
                  <span className="block text-xs text-on-surface-variant">{row.edition}</span>
                ) : null}
              </TableCell>
              <TableCell>
                <span className="block whitespace-nowrap">{row.soldOn}</span>
                <span className="block text-xs text-on-surface-variant">{row.channel}</span>
              </TableCell>
              <TableCell className={MONEY}>{formatPence(row.salePricePence)}</TableCell>
              <TableCell className={MONEY}>{formatPence(row.feesPence)}</TableCell>
              <TableCell className={`${MONEY} font-semibold text-on-surface`}>
                {formatPence(row.netPence)}
              </TableCell>
              <TableCell>
                <SellingStatus label={row.payout.label} tone={row.payout.tone} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SalesList({ rows }: { rows: SaleRowVm[] }) {
  return (
    <ul aria-label="Sales" className="flex flex-col divide-y divide-border-hairline md:hidden">
      {rows.map((row) => (
        <li key={row.saleId} className="flex flex-col gap-2 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium break-words text-on-surface">{row.title}</p>
              <p className="text-xs text-on-surface-variant">
                {[row.edition, row.soldOn, row.channel].filter(Boolean).join(" · ")}
              </p>
            </div>
            <p className="font-headline text-base font-semibold tabular-nums whitespace-nowrap">
              {formatPence(row.netPence)}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 text-xs text-on-surface-variant">
            <dt>Sale price</dt>
            <dd className={MONEY}>{formatPence(row.salePricePence)}</dd>
            <dt>LAX fees</dt>
            <dd className={MONEY}>{formatPence(row.feesPence)}</dd>
          </dl>
          <SellingStatus label={row.payout.label} tone={row.payout.tone} className="self-start" />
        </li>
      ))}
    </ul>
  );
}

/** The sales statement: totals for the chosen period, then each sale with its payout. */
export function SellingSales({ page }: { page: SalesPageVm }) {
  if (page.totalCount === 0) {
    return (
      <EmptyState
        className={EMPTY_STATE}
        headingLevel="h2"
        title="No sales yet"
        description="When an edition you sell is bought, it appears here with the LAX fees and what you are paid."
        action={
          <a
            href={SELLING_ROUTES.payouts}
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Check your payout setup
          </a>
        }
      />
    );
  }
  const { summary } = page;
  const csvHref =
    page.period === "all"
      ? SELLING_ROUTES.salesCsv
      : `${SELLING_ROUTES.salesCsv}?period=${page.period}`;
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <FilterToolbar
            action={SELLING_ROUTES.sales}
            noun="sales"
            fields={[
              {
                name: "period",
                label: "Period",
                value: page.period === "all" ? "" : page.period,
                options: SALES_PERIODS.filter((period) => period !== "all").map((period) => ({
                  value: period,
                  label: SALES_PERIOD_LABELS[period],
                })),
              },
            ]}
            shown={page.rows.length}
            total={page.totalCount}
          />
        </div>
        {page.rows.length > 0 ? (
          <Button asChild variant="outline" className="self-start">
            <a href={csvHref} download>
              Download CSV
            </a>
          </Button>
        ) : null}
      </div>

      {page.noneInPeriod ? (
        <EmptyState
          className={EMPTY_STATE}
          headingLevel="h2"
          title="No sales in this period"
          description="Choose another period, or clear the filter to see every sale."
          action={
            <a
              href={SELLING_ROUTES.sales}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Show all sales
            </a>
          }
        />
      ) : (
        <>
          <SellingStats
            label={`Totals for ${SALES_PERIOD_LABELS[page.period].toLowerCase()}${page.periodRange ? `, ${page.periodRange}` : ""}`}
          >
            <SellingStat
              label="Sales"
              value={String(summary.count)}
              {...(page.periodRange ? { hint: page.periodRange } : {})}
            />
            <SellingStat label="Sale price" value={formatPence(summary.salePricePence)} />
            <SellingStat label="LAX fees" value={formatPence(summary.feesPence)} />
            <SellingStat
              label="Net to you"
              value={formatPence(summary.netPence)}
              hint={`${formatPence(summary.paidOutPence)} paid · ${formatPence(summary.toComePence)} to come`}
            />
          </SellingStats>
          <AccountSection id="sales" title="Sold editions">
            <SalesTable rows={page.rows} />
            <SalesList rows={page.rows} />
          </AccountSection>
        </>
      )}
      <p className="text-sm text-on-surface-variant">
        Every payment across LAX, including what you pay, is in{" "}
        <a
          href={PORTFOLIO_ROUTES.money}
          className="underline underline-offset-4 hover:text-on-surface"
        >
          Money
        </a>
        .
      </p>
    </>
  );
}
