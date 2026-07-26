import type { DetailBoardFilter, DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import type { AdminLegalEntityDocument } from "@/lib/data/http/admin-legal-entities.types";

export type LegalEntityDocumentsFilter = "all" | "approved" | "pending" | "rejected";

export const LEGAL_ENTITY_DOCUMENTS_FILTERS: DetailBoardFilter<LegalEntityDocumentsFilter>[] = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "pending", label: "Pending" },
  { id: "rejected", label: "Rejected" },
];

export function buildLegalEntityDocumentsKpiTiles(
  documents: readonly AdminLegalEntityDocument[],
): DetailBoardKpiTile[] {
  const pending = documents.filter((doc) => doc.reviewStatus === "pending").length;
  const approved = documents.filter((doc) => doc.reviewStatus === "approved").length;

  return [
    {
      id: "total",
      label: "Total documents",
      value: String(documents.length),
      compareHint: "Uploaded for this entity",
    },
    {
      id: "pending",
      label: "Pending review",
      value: String(pending),
      compareHint: pending > 0 ? "Needs staff action" : "Queue clear",
      trendTone: pending > 0 ? "accent-gold" : "muted",
    },
    {
      id: "approved",
      label: "Approved",
      value: String(approved),
      compareHint: "Ready for onboarding",
      trendTone: approved > 0 ? "secondary" : "muted",
    },
  ];
}

export function filterLegalEntityDocuments(
  documents: readonly AdminLegalEntityDocument[],
  filter: LegalEntityDocumentsFilter,
): AdminLegalEntityDocument[] {
  if (filter === "all") return [...documents];
  return documents.filter((doc) => doc.reviewStatus === filter);
}

export function legalEntityDocumentLabel(doc: AdminLegalEntityDocument): string {
  if (doc.label?.trim()) return doc.label.trim();
  return doc.kind.replaceAll("_", " ");
}

export function matchesLegalEntityDocumentSearch(
  doc: AdminLegalEntityDocument,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [legalEntityDocumentLabel(doc), doc.kind, doc.contentType, doc.reviewStatus];
  return fields.some((field) => field?.toLowerCase().includes(q));
}

export function formatLegalEntityDocumentSize(byteSize: number | null): string {
  if (byteSize == null || byteSize <= 0) return "—";
  return `${Math.round(byteSize / 1024)} KB`;
}
