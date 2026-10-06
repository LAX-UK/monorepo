export type PortalDocumentKind =
  | "certificate"
  | "purchase_invoice"
  | "fee_evidence"
  | "other"
  | (string & {});

const LABELS: Record<string, string> = {
  certificate: "Certificate of authenticity",
  purchase_invoice: "Purchase invoice",
  fee_evidence: "Fee evidence",
  other: "Document",
};

export function resolvePortalDocumentKindLabel(kind: PortalDocumentKind): string {
  return LABELS[kind] ?? kind.replace(/_/g, " ");
}
