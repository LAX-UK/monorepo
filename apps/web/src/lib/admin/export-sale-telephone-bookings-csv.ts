import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { telephoneBookingStatusLabel } from "@/lib/telephone/telephone-booking-types";
import { formatCsvDocument } from "@auction/exports";

const COLUMNS = [
  { key: "id", header: "Booking ID" },
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "phone", header: "Phone" },
  { key: "status", header: "Status" },
  { key: "authorizedMax", header: "Authorized max" },
  { key: "requestedAt", header: "Requested at" },
] as const;

function toExportRow(row: AdminTelephoneBookingRow): Record<string, string> {
  return {
    id: row.id,
    name: row.userName ?? "",
    email: row.userEmail ?? "",
    phone: row.phoneDisplay ?? row.phoneE164,
    status: telephoneBookingStatusLabel(row.status),
    authorizedMax: row.authorizedMax ?? "",
    requestedAt: row.createdAt.toISOString(),
  };
}

export function downloadSaleTelephoneBookingsCsv(
  rows: readonly AdminTelephoneBookingRow[],
  saleTitle: string,
): void {
  const slug = saleTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug || "sale"}-telephone-bookings.csv`;
  const csv = formatCsvDocument([...COLUMNS], rows.map(toExportRow));

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
