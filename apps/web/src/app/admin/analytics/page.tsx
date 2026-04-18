import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminAnalytics } from "@/lib/data/http/admin.server";

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 font-mono text-xs text-on-surface-variant">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-surface-container-high">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
          role="presentation"
        />
      </div>
      <span className="w-10 text-right font-mono text-xs tabular-nums text-on-surface">
        {value}
      </span>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  let data: Awaited<ReturnType<typeof getAdminAnalytics>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getAdminAnalytics(30);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load analytics.";
  }

  const completedMax = Math.max(1, ...(data?.lotCompletedSeries.map((x) => x.count) ?? [0]));
  const revenueMax = Math.max(
    1,
    ...(data?.revenueSeries.map((x) => Number.parseFloat(x.total) || 0) ?? [0]),
  );
  const regMax = Math.max(1, ...(data?.registrationSeries.map((x) => x.count) ?? [0]));

  return (
    <div className="max-w-5xl space-y-10">
      <DisplayHeading as="h1" className="text-4xl">
        Analytics
      </DisplayHeading>
      {loadError ? (
        <p className="text-sm text-error" role="alert">
          {loadError}
        </p>
      ) : data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-outline-variant/15 p-4 ring-1 ring-outline-variant/10">
              <p className="font-label text-xs uppercase text-secondary">Active lots</p>
              <p className="mt-2 font-headline text-3xl tabular-nums">{data.activeLots}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/15 p-4 ring-1 ring-outline-variant/10">
              <p className="font-label text-xs uppercase text-secondary">Users</p>
              <p className="mt-2 font-headline text-3xl tabular-nums">{data.totalUsers}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/15 p-4 ring-1 ring-outline-variant/10">
              <p className="font-label text-xs uppercase text-secondary">Avg order (30d)</p>
              <p className="mt-2 font-headline text-3xl tabular-nums">
                {data.averageOrderValue ?? "—"}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant/15 p-6 ring-1 ring-outline-variant/10">
            <h2 className="mb-4 font-label text-xs uppercase tracking-widest text-secondary">
              Ended lots per day
            </h2>
            <div className="space-y-2">
              {data.lotCompletedSeries.map((row) => (
                <BarRow key={row.date} label={row.date} value={row.count} max={completedMax} />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant/15 p-6 ring-1 ring-outline-variant/10">
            <h2 className="mb-4 font-label text-xs uppercase tracking-widest text-secondary">
              Revenue per day
            </h2>
            <div className="space-y-2">
              {data.revenueSeries.map((row) => (
                <BarRow
                  key={row.date}
                  label={row.date}
                  value={Math.round(Number.parseFloat(row.total) || 0)}
                  max={revenueMax}
                />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant/15 p-6 ring-1 ring-outline-variant/10">
            <h2 className="mb-4 font-label text-xs uppercase tracking-widest text-secondary">
              New registrations per day
            </h2>
            <div className="space-y-2">
              {data.registrationSeries.map((row) => (
                <BarRow key={row.date} label={row.date} value={row.count} max={regMax} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-label text-xs uppercase tracking-widest text-secondary">
              Conversion (ended with winner / ended)
            </h2>
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
          </section>
        </>
      ) : null}
    </div>
  );
}
