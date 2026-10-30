import { csvDocument } from "@/lib/workspace/csv";
import type { ConsignmentRecord } from "./consignment-records";
import { CONSIGNMENT_STATUS } from "./consignment-status";
import { type ConsignmentsListQuery, consignmentsListSearch } from "./consignments-list";

const HEADER = [
  "reference",
  "title",
  "status",
  "sent_by",
  "sale",
  "date",
  "date_is",
  "price",
  "price_is",
  "sent_on",
] as const;

const DAY = (at: number) => new Date(at).toISOString().slice(0, 10);

/** Consignments as CSV: one row each, with the figures as the list shows them. */
export function consignmentsCsv(records: readonly ConsignmentRecord[]): string {
  return csvDocument(
    HEADER,
    records.map((record) => [
      record.reference ?? "",
      record.title,
      CONSIGNMENT_STATUS[record.status].label,
      record.sentBy ?? "",
      record.saleTitle ?? "",
      record.moment.value,
      record.moment.label,
      "value" in record.price ? record.price.value : "",
      "value" in record.price ? record.price.label : "",
      DAY(record.sentAt),
    ]),
  );
}

export function consignmentsCsvFilename(scope: string, now: Date): string {
  return `lax-consignments-${scope}-${now.toISOString().slice(0, 10)}.csv`;
}

/** The export's address: the list's own query, then what to export and the period. */
export function consignmentsExportHref(
  query: ConsignmentsListQuery,
  request: { scope: "view" | "all"; from?: string; to?: string },
): string {
  const params = new URLSearchParams(consignmentsListSearch(query).replace(/^\?/, ""));
  params.set("scope", request.scope);
  if (request.from) params.set("from", request.from);
  if (request.to) params.set("to", request.to);
  return `/selling/consignments/export?${params.toString()}`;
}
