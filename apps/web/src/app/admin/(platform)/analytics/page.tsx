import {
  AdminAnalyticsCharts,
  type AdminAnalyticsChartsData,
} from "@/components/admin/admin-analytics-charts";
import { AdminAnalyticsControls } from "@/components/admin/admin-analytics-controls";
import { AdminAnalyticsExport } from "@/components/admin/admin-analytics-export";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/ui/table-scroll";
import { getAdminAnalytics } from "@/lib/data/http/admin.server";
import {
  compareCountSeriesHalves,
  compareSeriesHalves,
  formatPctChange,
  pctToDeltaTone,
  sparklineForCounts,
  sparklineForMoney,
  winRatePercent,
} from "@/lib/data/view-models/admin-analytics.vm";
import { formatMoney } from "@/lib/format-currency";
import { CompareDelta, PageHeader } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

function toChartsData(
  d: NonNullable<Awaited<ReturnType<typeof getAdminAnalytics>>>,
): AdminAnalyticsChartsData {
  return {
    revenueSeries: d.revenueSeries,
    lotCompletedSeries: d.lotCompletedSeries,
    registrationSeries: d.registrationSeries,
    conversion: d.conversion,
  };
}

function parseDays(raw: string | undefined): number {
  if (raw == null || raw === "") return 30;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 30;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

type PageProps = {
  searchParams: Promise<{ days?: string }>;
};

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const days = parseDays(sp.days);

  let data: Awaited<ReturnType<typeof getAdminAnalytics>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getAdminAnalytics(days);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load analytics.";
  }

  const revHalf = data ? compareSeriesHalves(data.revenueSeries) : null;
  const lotHalf = data ? compareCountSeriesHalves(data.lotCompletedSeries) : null;
  const regHalf = data ? compareCountSeriesHalves(data.registrationSeries) : null;

  const totalRev = data
    ? data.revenueSeries.reduce((a, r) => a + (Number.parseFloat(r.total) || 0), 0)
    : 0;
  const totalEndedLots = data ? data.lotCompletedSeries.reduce((a, r) => a + (r.count || 0), 0) : 0;
  const totalRegs = data ? data.registrationSeries.reduce((a, r) => a + (r.count || 0), 0) : 0;

  return (
    <div className="screen w-full space-y-7">
      <PageHeader
        title="Analytics"
        description="Period KPIs compare first vs second half of the loaded window. Export raw series as CSV."
      />
      <AdminAnalyticsControls days={days} />
      {data ? <AdminAnalyticsExport data={toChartsData(data)} days={days} /> : null}
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load analytics</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : data ? (
        <>
          <KpiGrid
            tiles={[
              {
                label: `GMV (${days}d)`,
                value: formatMoney(totalRev),
                delta: (
                  <CompareDelta
                    label={formatPctChange(revHalf?.pctChange ?? null)}
                    tone={pctToDeltaTone(revHalf?.pctChange ?? null)}
                  />
                ),
                trend: sparklineForMoney(data.sparklines?.revenue, data.revenueSeries),
                trendTone: "primary",
              },
              {
                label: "Ended lots",
                value: String(totalEndedLots),
                delta: (
                  <CompareDelta
                    label={formatPctChange(lotHalf?.pctChange ?? null)}
                    tone={pctToDeltaTone(lotHalf?.pctChange ?? null)}
                  />
                ),
                trend: sparklineForCounts(data.sparklines?.lotCompleted, data.lotCompletedSeries),
                trendTone: "lot-orange",
              },
              {
                label: "New regs",
                value: String(totalRegs),
                delta: (
                  <CompareDelta
                    label={formatPctChange(regHalf?.pctChange ?? null)}
                    tone={pctToDeltaTone(regHalf?.pctChange ?? null)}
                  />
                ),
                trend: sparklineForCounts(data.sparklines?.registrations, data.registrationSeries),
                trendTone: "secondary",
              },
              {
                label: "Hammer rate",
                value: winRatePercent(data.conversion.ended, data.conversion.withWinner),
                delta: (
                  <CompareDelta
                    label={`${data.conversion.withWinner} / ${data.conversion.ended} ended`}
                    tone="neutral"
                  />
                ),
              },
              { label: "Active lots", value: String(data.activeLots), trendTone: "primary" },
              { label: "Total users", value: String(data.totalUsers), trendTone: "secondary" },
              {
                label: `Avg order (${days}d)`,
                value: data.averageOrderValue ?? "—",
                trend: sparklineForMoney(data.sparklines?.revenue, data.revenueSeries),
                trendTone: "lot-orange",
              },
              { label: "Window", value: `${days}d`, delta: "Loaded period" },
            ]}
          />

          <AdminAnalyticsCharts data={toChartsData(data)} />

          <section>
            <h2 className="mb-3 font-label text-xs uppercase tracking-widest text-secondary">
              Conversion (ended with winner / ended)
            </h2>
            <TableScroll>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Ended</TableHeaderCell>
                    <TableHeaderCell>With winner</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell className="tabular-nums">{data.conversion.ended}</TableCell>
                    <TableCell className="tabular-nums">{data.conversion.withWinner}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableScroll>
          </section>
        </>
      ) : null}
    </div>
  );
}
