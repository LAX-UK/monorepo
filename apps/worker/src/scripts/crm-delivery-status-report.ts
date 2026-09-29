import type { DomainEventDeliveryStatus } from "@auction/db/schema";

export type DeliveryStatusCountRow = {
  eventType: string;
  status: DomainEventDeliveryStatus;
  count: number;
};

export type DeliveryProblemRow = {
  eventId: number;
  eventType: string;
  attempts: number;
  updatedAt: string;
  lastError: string | null;
};

export type CrmDeliveryStatusSnapshot = {
  consumer: string;
  countsByEventTypeAndStatus: DeliveryStatusCountRow[];
  oldestPendingAgeSeconds: number | null;
  retryableRecent: DeliveryProblemRow[];
  deadLetteredRecent: DeliveryProblemRow[];
};

export function buildCrmDeliveryStatusReport(snapshot: CrmDeliveryStatusSnapshot): string {
  const lines: string[] = [
    JSON.stringify({
      consumer: snapshot.consumer,
      oldestPendingAgeSeconds: snapshot.oldestPendingAgeSeconds,
      countsByEventTypeAndStatus: snapshot.countsByEventTypeAndStatus,
    }),
  ];
  if (snapshot.retryableRecent.length > 0) {
    lines.push(JSON.stringify({ retryableRecent: snapshot.retryableRecent }));
  }
  if (snapshot.deadLetteredRecent.length > 0) {
    lines.push(JSON.stringify({ deadLetteredRecent: snapshot.deadLetteredRecent }));
  }
  return lines.join("\n");
}

export function aggregateStatusTotals(
  rows: DeliveryStatusCountRow[],
): Record<DomainEventDeliveryStatus, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    totals[row.status] = (totals[row.status] ?? 0) + row.count;
  }
  return totals as Record<DomainEventDeliveryStatus, number>;
}
