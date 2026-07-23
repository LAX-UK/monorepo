import {
  documentDisplayName,
  documentTypeLabel,
  documentVisibilityLabel,
} from "@/lib/data/view-models/sale-documents-tab.vm";
import { formatCsvDocument } from "@auction/exports";
import type { EntityDocument } from "@auction/types";

const COLUMNS = [
  { key: "id", header: "Document ID" },
  { key: "name", header: "Name" },
  { key: "type", header: "Type" },
  { key: "visibility", header: "Visibility" },
  { key: "uploadedAt", header: "Uploaded at" },
] as const;

function toExportRow(doc: EntityDocument): Record<string, string> {
  return {
    id: doc.id,
    name: documentDisplayName(doc),
    type: documentTypeLabel(doc.kind),
    visibility: documentVisibilityLabel(doc),
    uploadedAt: doc.createdAt.toISOString(),
  };
}

export function downloadSaleDocumentsCsv(
  documents: readonly EntityDocument[],
  saleTitle: string,
): void {
  const slug = saleTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug || "sale"}-documents.csv`;
  const csv = formatCsvDocument([...COLUMNS], documents.map(toExportRow));

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
