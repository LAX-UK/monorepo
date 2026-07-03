/** Row shape after joining `upload_object` (persistence read model). */
export type EntityDocumentPersistedRow = {
  id: string;
  entityId: string;
  kind: string;
  label: string | null;
  uploadObjectId: string;
  key: string;
  actualByteSize: number | null;
  actualContentType: string | null;
  createdByUserId: string | null;
  createdAt: Date;
};
