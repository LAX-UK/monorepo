import type { DetailBoardFilter, DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import { documentVisibilityDotStatus } from "@/lib/presenters/status/dot-status-presenters";
import type { EntityDocument } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";

export type LotDocumentsFilter = "all" | "internal" | "public";

export const LOT_DOCUMENTS_FILTERS: DetailBoardFilter<LotDocumentsFilter>[] = [
  { id: "all", label: "All documents" },
  { id: "internal", label: "Internal" },
  { id: "public", label: "Public" },
];

function isPublicDocument(doc: EntityDocument): boolean {
  return doc.kind === "terms" || doc.kind === "catalog";
}

export function buildLotDocumentsKpiTiles(
  documents: readonly EntityDocument[],
): DetailBoardKpiTile[] {
  const publicCount = documents.filter(isPublicDocument).length;
  const internalCount = documents.length - publicCount;
  return [
    {
      id: "total",
      label: "Total documents",
      value: String(documents.length),
      compareHint: "Attached to this lot",
    },
    {
      id: "public",
      label: "Public",
      value: String(publicCount),
      compareHint: "Visible to bidders",
    },
    {
      id: "internal",
      label: "Internal",
      value: String(internalCount),
      compareHint: "Staff only",
    },
  ];
}

export function filterLotDocuments(
  documents: readonly EntityDocument[],
  filter: LotDocumentsFilter,
): EntityDocument[] {
  if (filter === "public") return documents.filter(isPublicDocument);
  if (filter === "internal") return documents.filter((d) => !isPublicDocument(d));
  return [...documents];
}

export function documentTypeLabel(kind: EntityDocument["kind"]): string {
  if (kind === "terms") return "Terms";
  if (kind === "catalog") return "Catalogue";
  return "Internal";
}

export function documentVisibilityTone(doc: EntityDocument): DotStatusPillTone {
  return documentVisibilityDotStatus(doc).tone;
}

export function documentVisibilityLabel(doc: EntityDocument): string {
  return documentVisibilityDotStatus(doc).label;
}

export function matchesLotDocumentSearch(doc: EntityDocument, query: string): boolean {
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
