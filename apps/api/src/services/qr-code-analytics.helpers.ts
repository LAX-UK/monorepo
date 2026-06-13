import type { QrCodeAnalyticsBreakdownRow } from "@auction/validators";

export type QrAnalyticsBreakdownRow = QrCodeAnalyticsBreakdownRow;
export type QrAnalyticsTrendRow = { bucket: string; scans: number };

function utcDayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Half-open daily upper bound: includes the UTC day containing `to`. */
export function dailyUpperExclusiveDay(to: Date): Date {
  const upper = utcDayStart(to);
  upper.setUTCDate(upper.getUTCDate() + 1);
  return upper;
}

export function formatHourBucket(d: Date): string {
  const x = new Date(d);
  x.setUTCMinutes(0, 0, 0);
  return x.toISOString();
}

export function formatDayBucket(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function foldTopN(
  rows: QrAnalyticsBreakdownRow[],
  total: number,
  topN = 5,
): QrAnalyticsBreakdownRow[] {
  if (total <= 0) return [];
  const sorted = [...rows].sort((a, b) => b.scans - a.scans);
  const top = sorted.slice(0, topN);
  const topSum = top.reduce((sum, row) => sum + row.scans, 0);
  const rest = total - topSum;
  if (rest > 0 && sorted.length > topN) {
    top.push({ key: "other", scans: rest });
  }
  return top;
}

export function fillTrendGaps(
  rows: QrAnalyticsTrendRow[],
  from: Date | null,
  to: Date,
  granularity: "hour" | "day",
): QrAnalyticsTrendRow[] {
  if (!from) return [...rows].sort((a, b) => a.bucket.localeCompare(b.bucket));

  const byBucket = new Map(rows.map((row) => [row.bucket, row.scans]));
  const out: QrAnalyticsTrendRow[] = [];
  const cursor = new Date(from);

  if (granularity === "hour") {
    cursor.setUTCMinutes(0, 0, 0);
    while (cursor < to) {
      const bucket = formatHourBucket(cursor);
      out.push({ bucket, scans: byBucket.get(bucket) ?? 0 });
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    }
    return out;
  }

  cursor.setUTCHours(0, 0, 0, 0);
  const end = utcDayStart(to);
  while (cursor <= end) {
    const bucket = formatDayBucket(cursor);
    out.push({ bucket, scans: byBucket.get(bucket) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function normalizeBreakdownKey(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "unknown";
}
