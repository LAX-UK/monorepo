/** Row from `GET /lots/:id/documents` (contracts, certificates, etc.). */
export type LotDocumentPublicRow = {
  id: string;
  kind: string;
  label: string | null;
  downloadUrl: string;
};
