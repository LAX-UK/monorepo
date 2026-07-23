import type { DetailBoardFilter, DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import { documentVisibilityDotStatus } from "@/lib/presenters/status/dot-status-presenters";
import type { EntityDocument } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";

export type SaleDocumentsFilter = "internal" | "sale";

export const SALE_DOCUMENTS_FILTERS: DetailBoardFilter<SaleDocumentsFilter>[] = [
  { id: "internal", label: "Internal documents" },
  { id: "sale", label: "Sale documents" },
];

function isPublicDocument(doc: EntityDocument): boolean {
  return doc.kind === "terms" || doc.kind === "catalog";
}

export function buildSaleDocumentsKpiTiles(
  documents: readonly EntityDocument[],
): DetailBoardKpiTile[] {
  const publicCount = documents.filter(isPublicDocument).length;
  const internalCount = documents.length - publicCount;
  return [
    {
      id: "total",
      label: "Total documents",
      value: String(documents.length),
      compareHint: "All categories covered",
    },
    {
      id: "public",
      label: "Public documents",
      value: String(publicCount),
      compareHint: "Visible to registered bidders",
    },
    {
      id: "internal",
      label: "Internal documents",
      value: String(internalCount),
      compareHint: "Staff only and hidden",
    },
  ];
}

export function filterSaleDocuments(
  documents: readonly EntityDocument[],
  filter: SaleDocumentsFilter,
): EntityDocument[] {
  if (filter === "sale") return documents.filter(isPublicDocument);
  return documents.filter((d) => !isPublicDocument(d));
}

export function documentTypeLabel(kind: EntityDocument["kind"]): string {
  if (kind === "terms") return "Terms of sale";
  if (kind === "catalog") return "Sale catalogue";
  return "Internal";
}

export function documentVisibilityTone(doc: EntityDocument): DotStatusPillTone {
  return documentVisibilityDotStatus(doc).tone;
}

export function documentVisibilityLabel(doc: EntityDocument): string {
  return documentVisibilityDotStatus(doc).label;
}

export function matchesSaleDocumentSearch(doc: EntityDocument, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [doc.label, doc.fileName, doc.kind];
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export function documentCreatedAtIso(doc: EntityDocument): string {
  return doc.createdAt.toISOString();
}

export function documentDisplayName(doc: EntityDocument): string {
  return doc.label?.trim() || doc.fileName?.trim() || "Untitled document";
}
