import { type SaleListRow, parseSaleListRowApiPayload } from "@/lib/sale-list-row";

type SaleStatus = "scheduled" | "active" | "ended";

/** A sale list row as the API sends it, for calendar tests. */
export function calendarSaleRow(
  id: string,
  status: SaleStatus,
  extra: { consignmentDeadline?: string; resultsSummary?: unknown; endTime?: string } = {},
): SaleListRow {
  return parseSaleListRowApiPayload({
    sale: {
      id,
      title: `Sale ${id}`,
      coverImages: [],
      categoryIds: [],
      deliveryMode: "online",
      status,
      startTime: "2026-09-01T10:00:00.000Z",
      endTime: extra.endTime ?? "2026-10-15T17:00:00.000Z",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      ...(extra.consignmentDeadline ? { consignmentDeadline: extra.consignmentDeadline } : {}),
    },
    lots: [],
    lotCount: 24,
    ...(extra.resultsSummary ? { resultsSummary: extra.resultsSummary } : {}),
  });
}
