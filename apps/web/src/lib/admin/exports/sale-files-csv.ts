import { documentKindLabel } from "@/lib/admin/document-kind-labels";
import { formatCsvDocument } from "@auction/exports";
import type { EntityDocument } from "@auction/types";

/** "Modern British Art" → "modern-british-art", for file names. */
function slug(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "sale"
  );
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const BIDDER_KINDS = new Set(["terms", "catalog"]);

const DOCUMENT_COLUMNS = [
  { key: "name", header: "Name" },
  { key: "type", header: "Type" },
  { key: "visibility", header: "Who can open it" },
  { key: "file", header: "File name" },
  { key: "addedAt", header: "Added at" },
  { key: "id", header: "Document ID" },
] as const;

/** One row per document, as the CSV shows it. */
export function saleDocumentCsvRows(documents: readonly EntityDocument[]) {
  return documents.map((doc) => ({
    name: doc.label?.trim() || doc.fileName || documentKindLabel(doc.kind),
    type: documentKindLabel(doc.kind),
    visibility: BIDDER_KINDS.has(doc.kind) ? "Registered bidders" : "Staff only",
    file: doc.fileName ?? "",
    addedAt: new Date(doc.createdAt).toISOString(),
    id: doc.id,
  }));
}

export function downloadSaleDocumentsCsv(documents: readonly EntityDocument[], saleTitle: string) {
  download(
    `${slug(saleTitle)}-documents.csv`,
    formatCsvDocument([...DOCUMENT_COLUMNS], saleDocumentCsvRows(documents)),
  );
}

export type SaleMediaCsvItem = {
  key: string;
  mediaType: "image" | "video";
  caption: string;
  alt: string;
};

const MEDIA_COLUMNS = [
  { key: "position", header: "Position" },
  { key: "type", header: "Type" },
  { key: "caption", header: "Caption" },
  { key: "alt", header: "Alt text" },
  { key: "key", header: "Storage key" },
] as const;

/** One row per item, in gallery order. */
export function saleMediaCsvRows(items: readonly SaleMediaCsvItem[], positions: readonly number[]) {
  return items.map((item, i) => ({
    position: String(positions[i] ?? i + 1),
    type: item.mediaType === "video" ? "Video" : "Photo",
    caption: item.caption,
    alt: item.mediaType === "video" ? "" : item.alt,
    key: item.key,
  }));
}

export function downloadSaleMediaCsv(
  items: readonly SaleMediaCsvItem[],
  positions: readonly number[],
  saleTitle: string,
) {
  download(
    `${slug(saleTitle)}-media.csv`,
    formatCsvDocument([...MEDIA_COLUMNS], saleMediaCsvRows(items, positions)),
  );
}

/** Whether a media item matches what was typed: its caption, alt text or file. */
export function matchesSaleMediaSearch(item: SaleMediaCsvItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.caption, item.alt, item.key].some((field) => field.toLowerCase().includes(q));
}

/** Whether a document matches what was typed: its label, file name or type. */
export function matchesSaleDocumentSearch(doc: EntityDocument, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [doc.label, doc.fileName, documentKindLabel(doc.kind)].some((field) =>
    field?.toLowerCase().includes(q),
  );
}
