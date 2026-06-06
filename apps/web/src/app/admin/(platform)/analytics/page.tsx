import {
  AdminAnalyticsCharts,
  type AdminAnalyticsChartsData,
} from "@/components/admin/admin-analytics-charts";
import { AdminAnalyticsControls } from "@/components/admin/admin-analytics-controls";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { ExportButton } from "@/components/exports/export-button";
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
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { CompareDelta } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Analytics",
  "Period KPIs, revenue trends, and conversion metrics.",
);

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
  const hammerRate = data ? winRatePercent(data.conversion.ended, data.conversion.withWinner) : "—";

  const primaryAction = (
    <div className="flex flex-wrap items-center gap-2">
      <AdminAnalyticsControls days={days} />
      {data ? (
        <>
          <ExportButton
            entityType="analytics"
            label="Export revenue CSV"
            variant="secondary"
            filters={{ days, series: "revenue" }}
          />
          <ExportButton
            entityType="analytics"
            label="Export lots CSV"
            variant="secondary"
            filters={{ days, series: "ended_lots" }}
          />
          <ExportButton
            entityType="analytics"
            label="Export registrations CSV"
            variant="secondary"
            filters={{ days, series: "registrations" }}
          />
        </>
      ) : null}
    </div>
  );

  return (
    <AdminListShell
      variant="report"
      title="Analytics"
      description="Period KPIs compare first vs second half of the loaded window. Export raw series as CSV."
      primaryAction={primaryAction}
      mobileSummary={
        data ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "gmv", label: `GMV (${days}d)`, value: formatMoney(totalRev) },
              { id: "lots", label: "Ended lots", value: String(totalEndedLots) },
              { id: "regs", label: "New regs", value: String(totalRegs) },
              { id: "hammer", label: "Hammer rate", value: hammerRate },
            ]}
          />
        ) : null
      }
      kpiStrip={
        data ? (
          <AdminListKpiStrip
            ariaLabel="Analytics summary"
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
                value: hammerRate,
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
        ) : null
      }
      errorAlert={
        loadError ? (
          <AdminListAlert title="Could not load analytics">{loadError}</AdminListAlert>
        ) : null
      }
      wrapView={false}
      view={
        data ? (
          <div className="space-y-8">
            <AdminAnalyticsCharts data={toChartsData(data)} />
            <section>
              <h2 className="mb-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
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
          </div>
        ) : null
      }
    />
  );
}
