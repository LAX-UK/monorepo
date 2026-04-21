import {
  AdminAnalyticsCharts,
  type AdminAnalyticsChartsData,
} from "@/components/admin/admin-analytics-charts";
import { AdminAnalyticsControls } from "@/components/admin/admin-analytics-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/ui/table-scroll";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminAnalytics } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { KpiTile } from "@auction/ui/components/kpi-tile";

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

  const trend = [0.35, 0.42, 0.4, 0.48, 0.52, 0.5, 0.58] as const;

  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-10">
      <DisplayHeading as="h1" className="text-4xl text-brand-900 dark:text-on-surface">
        Analytics
      </DisplayHeading>
      <AdminAnalyticsControls days={days} />
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load analytics</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <KpiTile
              label="Active lots"
              value={String(data.activeLots)}
              trend={trend}
              trendTone="primary"
            />
            <KpiTile
              label="Users"
              value={String(data.totalUsers)}
              trend={trend}
              trendTone="secondary"
            />
            <KpiTile
              label={`Avg order (${days}d)`}
              value={data.averageOrderValue ?? "—"}
              trend={trend}
              trendTone="lot-orange"
            />
          </section>

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
