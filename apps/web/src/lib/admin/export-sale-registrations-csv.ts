import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import { formatCsvDocument } from "@auction/exports";

const COLUMNS = [
  { key: "id", header: "Registration ID" },
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "status", header: "Status" },
  { key: "paddle", header: "Paddle" },
  { key: "bidLimit", header: "Bid limit" },
  { key: "kycStatus", header: "KYC status" },
  { key: "requestedAt", header: "Requested at" },
  { key: "checkedInAt", header: "Checked in at" },
] as const;

function toExportRow(row: AdminSaleRegistrationRow): Record<string, string> {
  return {
    id: row.id,
    name: row.userName ?? "",
    email: row.userEmail ?? "",
    status: row.status,
    paddle: row.paddleNumber != null ? String(row.paddleNumber) : "",
    bidLimit: row.bidLimit ?? "",
    kycStatus: row.kycStatus ?? "",
    requestedAt: row.requestedAt,
    checkedInAt: row.checkedInAt ?? "",
  };
}

/** Client-side CSV export for the sale registrations table (Figma Export register). */
export function downloadSaleRegistrationsCsv(
  rows: readonly AdminSaleRegistrationRow[],
  saleTitle: string,
): void {
  const slug = saleTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug || "sale"}-registrations.csv`;
  const csv = formatCsvDocument([...COLUMNS], rows.map(toExportRow));

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
