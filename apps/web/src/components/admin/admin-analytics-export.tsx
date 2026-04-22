"use client";

import type { AdminAnalyticsChartsData } from "@/components/admin/admin-analytics-charts";
import { Button } from "@auction/ui/components/button";

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (c: string) => `"${c.replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map((c) => esc(String(c))).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  data: AdminAnalyticsChartsData;
  days: number;
};

export function AdminAnalyticsExport({ data, days }: Props) {
  const onExportRevenue = () => {
    const rows: string[][] = [
      ["date", "revenue"],
      ...data.revenueSeries.map((r) => [r.date, r.total]),
    ];
    downloadCsv(`analytics-revenue-${days}d.csv`, rows);
  };

  const onExportLots = () => {
    const rows: string[][] = [
      ["date", "ended_lots"],
      ...data.lotCompletedSeries.map((r) => [r.date, String(r.count)]),
    ];
    downloadCsv(`analytics-ended-lots-${days}d.csv`, rows);
  };

  const onExportRegs = () => {
    const rows: string[][] = [
      ["date", "registrations"],
      ...data.registrationSeries.map((r) => [r.date, String(r.count)]),
    ];
    downloadCsv(`analytics-registrations-${days}d.csv`, rows);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" className="min-h-11" onClick={onExportRevenue}>
        Export revenue CSV
      </Button>
      <Button type="button" variant="secondary" className="min-h-11" onClick={onExportLots}>
        Export lots CSV
      </Button>
      <Button type="button" variant="secondary" className="min-h-11" onClick={onExportRegs}>
        Export registrations CSV
      </Button>
    </div>
  );
}
