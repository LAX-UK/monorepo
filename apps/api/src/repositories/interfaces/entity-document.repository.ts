import type { LotDocumentKind, SaleDocumentKind, SubmissionDocumentKind } from "@auction/types";
import type { EntityDocumentPersistedRow } from "../../lib/entity-document-presenter.js";

export interface IEntityDocumentRepository<TKind extends string = string> {
  attach(input: {
    entityId: string;
    kind: TKind;
    label: string | null;
    uploadObjectId: string;
    createdByUserId: string;
  }): Promise<EntityDocumentPersistedRow>;
  remove(entityId: string, documentId: string): Promise<void>;
  listRowsForEntity(entityId: string): Promise<EntityDocumentPersistedRow[]>;
  /** Batch — used by list endpoints to avoid N+1. */
  listRowsForEntityIds(entityIds: string[]): Promise<Map<string, EntityDocumentPersistedRow[]>>;
}

export type ILotDocumentRepository = IEntityDocumentRepository<LotDocumentKind>;
export type ISaleDocumentRepository = IEntityDocumentRepository<SaleDocumentKind>;
export type ISubmissionDocumentRepository = IEntityDocumentRepository<SubmissionDocumentKind>;
