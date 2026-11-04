import type { Database } from "@auction/db";

export type CrmRecordLinkRow = {
  entityType: string;
  entityId: string;
  zohoModule: string;
  zohoRecordId: string;
  subjectId: string | null;
  erasedAt: Date | null;
  deletionRequestedAt: Date | null;
  recyclePurgedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertCrmRecordLinkInput = {
  entityType: string;
  entityId: string;
  zohoModule: string;
  zohoRecordId: string;
  subjectId?: string | null;
  now?: Date;
};

export type MergeCrmSubjectLinksResult = {
  duplicateZohoModule?: string;
  duplicateZohoRecordId?: string;
};

export interface ICrmRecordLinkRepository {
  findByEntity(entityType: string, entityId: string): Promise<CrmRecordLinkRow | null>;
  upsertLink(input: UpsertCrmRecordLinkInput): Promise<void>;
  mergeSubjectLinks(input: {
    canonicalSubjectId: string;
    retiredSubjectId: string;
    tombstoneModule: string;
    tombstoneRecordId: string;
    now?: Date;
  }): Promise<MergeCrmSubjectLinksResult>;
  reassignDealLinksSubjectId(
    fromSubjectId: string,
    toSubjectId: string,
    now?: Date,
  ): Promise<number>;
  markErased(entityType: string, entityId: string, now?: Date): Promise<void>;
  tombstone(input: {
    entityType: string;
    entityId: string;
    tombstoneModule: string;
    tombstoneRecordId: string;
    now?: Date;
  }): Promise<void>;
  tombstoneDealByZohoRecordId(zohoRecordId: string, now?: Date): Promise<void>;
  setDeletionRequested(entityType: string, entityId: string, now?: Date): Promise<void>;
  clearDeletionRequested(entityType: string, entityId: string, now?: Date): Promise<void>;
  isDeletionRequested(entityType: string, entityId: string): Promise<boolean>;
  markRecyclePurged(entityType: string, entityId: string, now?: Date): Promise<void>;
  isErased(entityType: string, entityId: string): Promise<boolean>;
  listActiveDealLinksBySubject(subjectId: string): Promise<CrmRecordLinkRow[]>;
  /**
   * The people-and-leads links, not yet erased, that point at one Zoho record. A person's account,
   * guest checkout and enquiries share one record when they share an email address.
   */
  listActiveSubjectLinksByZohoRecord(
    zohoModule: string,
    zohoRecordId: string,
  ): Promise<CrmRecordLinkRow[]>;
  listActiveByEntityType(
    entityType: string,
    limit: number,
    offset: number,
  ): Promise<CrmRecordLinkRow[]>;
  listErasedWithRealZohoLinks(
    entityType: string,
    limit: number,
    offset: number,
  ): Promise<CrmRecordLinkRow[]>;
}

export type CrmRecordLinkDb = Database;
