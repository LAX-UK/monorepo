"use client";

import { ChartRenderer } from "@/components/charts/chart-renderer";
import { Surface } from "@auction/ui/components/surface";

/** Serializable analytics payload (avoid importing `server-only` modules in client). */
export type AdminAnalyticsChartsData = {
  revenueSeries: { date: string; total: string }[];
  lotCompletedSeries: { date: string; count: number }[];
  registrationSeries: { date: string; count: number }[];
  conversion: { ended: number; withWinner: number };
};

type Props = {
  data: AdminAnalyticsChartsData;
};

export function AdminAnalyticsCharts({ data }: Props) {
  const revenueLine = data.revenueSeries.map((row) => ({
    x: row.date,
    y: Math.round(Number.parseFloat(row.total) || 0),
  }));
  const endedBars = data.lotCompletedSeries.map((row) => ({
    label: row.date,
    value: row.count,
  }));
  const regBars = data.registrationSeries.map((row) => ({
    label: row.date,
    value: row.count,
  }));
  const won = data.conversion.withWinner;
  const lost = Math.max(0, data.conversion.ended - data.conversion.withWinner);
  const donut = [
    { label: "With winner", value: won },
    { label: "No winner", value: lost },
  ];

  return (
    <div className="@container min-w-0">
      <div className="grid grid-cols-1 gap-6 @[720px]:grid-cols-2">
        <Surface variant="card" className="border-border-hairline">
          <h3 className="font-headline text-lg font-semibold text-on-surface">Revenue (series)</h3>
          <div>
            <ChartRenderer kind="line" data={revenueLine} height={180} />
          </div>
        </Surface>
        <Surface variant="card" className="border-border-hairline">
          <h3 className="font-headline text-lg font-semibold text-on-surface">
            Ended lots per day
          </h3>
          <div>
            <ChartRenderer kind="bar" data={endedBars} height={180} />
          </div>
        </Surface>
        <Surface variant="card" className="border-border-hairline">
          <h3 className="font-headline text-lg font-semibold text-on-surface">New registrations</h3>
          <div>
            <ChartRenderer kind="bar" data={regBars} height={180} />
          </div>
        </Surface>
        <Surface variant="card" className="border-border-hairline">
          <h3 className="font-headline text-lg font-semibold text-on-surface">Conversion</h3>
          <div>
            <ChartRenderer kind="donut" data={donut} size={160} />
          </div>
        </Surface>
      </div>
    </div>
  );
}
