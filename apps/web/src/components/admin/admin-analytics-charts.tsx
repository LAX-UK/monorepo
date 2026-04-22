"use client";

import { ChartRenderer } from "@/components/charts/chart-renderer";
import { Card, CardContent, CardHeader, CardTitle } from "@auction/ui/components/card";

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
        <Card className="border-outline-variant/15">
          <CardHeader>
            <CardTitle className="font-headline text-lg">Revenue (series)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartRenderer kind="line" data={revenueLine} height={180} />
          </CardContent>
        </Card>
        <Card className="border-outline-variant/15">
          <CardHeader>
            <CardTitle className="font-headline text-lg">Ended lots per day</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartRenderer kind="bar" data={endedBars} height={180} />
          </CardContent>
        </Card>
        <Card className="border-outline-variant/15">
          <CardHeader>
            <CardTitle className="font-headline text-lg">New registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartRenderer kind="bar" data={regBars} height={180} />
          </CardContent>
        </Card>
        <Card className="border-outline-variant/15">
          <CardHeader>
            <CardTitle className="font-headline text-lg">Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartRenderer kind="donut" data={donut} size={160} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
