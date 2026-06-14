import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import { zipSync } from "fflate";
import type { ISourceOfFundsDocumentRepository } from "../../repositories/drizzle-source-of-funds-document.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IObjectStorage } from "../interfaces/object-storage.js";
import type { ISignedUrlPolicy } from "../signed-url-policy.js";
import { SourceOfFundsSettlementReadService } from "./source-of-funds-settlement-read.service.js";
import type {
  ISourceOfFundsRepository,
  SourceOfFundsCase,
  SourceOfFundsDocumentRow,
} from "./source-of-funds.types.js";

export const SOURCE_OF_FUNDS_DOCUMENTS_REQUESTED_EVENT = "source_of_funds.documents_requested";
export const SOURCE_OF_FUNDS_DOCUMENTS_SUBMITTED_EVENT = "source_of_funds.documents_submitted";
export const SOURCE_OF_FUNDS_DOCUMENT_UPLOADED_EVENT = "source_of_funds.document_uploaded";
export const SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT = "source_of_funds.document_downloaded";

export type BuyerSourceOfFundsDocumentDto = {
  id: string;
  requestedType: string;
  label: string | null;
  fileName: string | null;
  statusLabel: "received" | "under_review" | "superseded";
  uploadedAt: string;
};

export type BuyerSourceOfFundsViewDto = {
  caseId: string;
  status: SourceOfFundsCase["status"];
  trigger: SourceOfFundsCase["trigger"];
  documentsRequested: boolean;
  documentsSubmitted: boolean;
  requestedDocumentTypes: string[];
  documentRequestNote: string | null;
  documents: BuyerSourceOfFundsDocumentDto[];
  settlementSummary: string | null;
  settlementItemCount: number;
  /** Shown only after terminal decision — no internal triage notes. */
  decisionOutcome: "approved" | "rejected" | null;
};

export type AdminSourceOfFundsDocumentDto = {
  id: string;
  requestedType: string;
  label: string | null;
  fileName: string | null;
  reviewStatus: string;
  uploadedAt: string;
  uploadedByUserId: string;
  downloadUrl: string | null;
};

export class SourceOfFundsDocumentCollectionService {
  private readonly settlementRead: SourceOfFundsSettlementReadService;

  constructor(
    private readonly caseRepo: ISourceOfFundsRepository,
    private readonly docRepo: ISourceOfFundsDocumentRepository,
    private readonly db: Database,
    private readonly events: DomainEventPublisher | null,
    private readonly storage: IObjectStorage,
    private readonly downloadSigningPolicy: ISignedUrlPolicy,
  ) {
    this.settlementRead = new SourceOfFundsSettlementReadService(db);
  }

  async requestDocuments(command: {
    caseId: string;
    staffUserId: string;
    documentTypes: string[];
    note: string | null;
  }): Promise<SourceOfFundsCase> {
    const types = [...new Set(command.documentTypes.map((t) => t.trim()).filter(Boolean))];
    if (types.length === 0) throw new Error("source_of_funds_document_types_required");

    const run = async (conn: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.caseRepo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.status !== "pending") throw new Error("source_of_funds_not_pending");

      const updated = await this.caseRepo.setDocumentRequest(
        {
          id: command.caseId,
          requestedByUserId: command.staffUserId,
          documentTypes: types,
          note: command.note,
        },
        conn,
      );
      if (!updated) throw new Error("source_of_funds_request_failed");

      if (this.events) {
        await this.events.publish(conn, {
          aggregateType: "source_of_funds",
          aggregateId: updated.id,
          eventType: SOURCE_OF_FUNDS_DOCUMENTS_REQUESTED_EVENT,
          actorUserId: command.staffUserId,
          payload: {
            sourceOfFundsId: updated.id,
            userId: updated.userId,
            documentTypes: types,
            note: command.note,
          },
        });
      }
      return updated;
    };

    return this.db.transaction((tx) => run(tx));
  }

  async attachDocument(command: {
    caseId: string;
    buyerUserId: string;
    uploadObjectId: string;
    requestedType: string;
    label: string | null;
  }): Promise<SourceOfFundsDocumentRow> {
    const requestedType = command.requestedType.trim();
    if (!requestedType) throw new Error("source_of_funds_requested_type_required");

    const run = async (conn: Database): Promise<SourceOfFundsDocumentRow> => {
      const existing = await this.caseRepo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.userId !== command.buyerUserId) throw new Error("source_of_funds_forbidden");
      if (existing.status !== "pending") throw new Error("source_of_funds_not_pending");
      if (!existing.documentsRequestedAt)
        throw new Error("source_of_funds_documents_not_requested");
      if (existing.documentsSubmittedAt)
        throw new Error("source_of_funds_documents_already_submitted");

      const allowed = existing.requestedDocumentTypes ?? [];
      if (!allowed.includes(requestedType)) {
        throw new Error("source_of_funds_requested_type_not_allowed");
      }

      const [upload] = await conn
        .select({ id: uploadObject.id, status: uploadObject.status, kind: uploadObject.kind })
        .from(uploadObject)
        .where(
          and(
            eq(uploadObject.id, command.uploadObjectId),
            eq(uploadObject.ownerUserId, command.buyerUserId),
          ),
        )
        .limit(1);
      if (!upload || upload.status !== "active") {
        throw new Error("upload_not_active");
      }
      if (upload.kind !== "source_of_funds_document") {
        throw new Error("upload_kind_mismatch");
      }

      await this.docRepo.supersedeActiveForType(command.caseId, requestedType, conn);
      const doc = await this.docRepo.attach(
        {
          sourceOfFundsId: command.caseId,
          uploadObjectId: command.uploadObjectId,
          requestedType,
          label: command.label,
          uploadedByUserId: command.buyerUserId,
        },
        conn,
      );

      if (this.events) {
        await this.events.publish(conn, {
          aggregateType: "source_of_funds",
          aggregateId: command.caseId,
          eventType: SOURCE_OF_FUNDS_DOCUMENT_UPLOADED_EVENT,
          actorUserId: command.buyerUserId,
          payload: {
            sourceOfFundsId: command.caseId,
            documentId: doc.id,
            requestedType,
            userId: command.buyerUserId,
          },
        });
      }
      return doc;
    };

    return this.db.transaction((tx) => run(tx));
  }

  async submitDocuments(command: {
    caseId: string;
    buyerUserId: string;
  }): Promise<SourceOfFundsCase> {
    const run = async (conn: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.caseRepo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.userId !== command.buyerUserId) throw new Error("source_of_funds_forbidden");
      if (!existing.documentsRequestedAt)
        throw new Error("source_of_funds_documents_not_requested");
      if (existing.documentsSubmittedAt)
        throw new Error("source_of_funds_documents_already_submitted");

      const count = await this.docRepo.countActiveForCase(command.caseId, conn);
      if (count === 0) throw new Error("source_of_funds_no_documents_to_submit");

      const updated = await this.caseRepo.setDocumentsSubmitted(command.caseId, conn);
      if (!updated) throw new Error("source_of_funds_submit_failed");

      if (this.events) {
        await this.events.publish(conn, {
          aggregateType: "source_of_funds",
          aggregateId: updated.id,
          eventType: SOURCE_OF_FUNDS_DOCUMENTS_SUBMITTED_EVENT,
          actorUserId: command.buyerUserId,
          payload: {
            sourceOfFundsId: updated.id,
            userId: updated.userId,
            documentCount: count,
          },
        });
      }
      return updated;
    };

    return this.db.transaction((tx) => run(tx));
  }

  async getBuyerView(buyerUserId: string): Promise<BuyerSourceOfFundsViewDto | null> {
    const caseRecord = await this.caseRepo.findLatestForUser(buyerUserId);
    if (!caseRecord) return null;
    if (caseRecord.status === "approved") {
      const approved = caseRecord;
      return this.buildBuyerView(approved, "approved");
    }
    if (caseRecord.status === "rejected") {
      return this.buildBuyerView(caseRecord, "rejected");
    }
    return this.buildBuyerView(caseRecord, null);
  }

  async getStaffDownloadUrl(command: {
    caseId: string;
    documentId: string;
    staffUserId: string;
    clientIp?: string | null;
  }): Promise<{ url: string; fileName: string } | null> {
    const caseRecord = await this.caseRepo.findById(command.caseId);
    if (!caseRecord) return null;

    const doc = await this.docRepo.findById(command.documentId);
    if (!doc || doc.sourceOfFundsId !== command.caseId) return null;

    const [upload] = await this.db
      .select({ key: uploadObject.key })
      .from(uploadObject)
      .where(eq(uploadObject.id, doc.uploadObjectId))
      .limit(1);
    if (!upload) return null;

    const signed = await this.storage.createPresignedGet({
      key: upload.key,
      expiresInSec: this.downloadSigningPolicy.expiresInSec,
    });

    const events = this.events;
    if (events) {
      await this.db.transaction(async (tx) => {
        await events.publish(tx, {
          aggregateType: "source_of_funds",
          aggregateId: command.caseId,
          eventType: SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT,
          actorUserId: command.staffUserId,
          payload: {
            sourceOfFundsId: command.caseId,
            documentId: command.documentId,
            clientIp: command.clientIp ?? null,
          },
        });
      });
    }

    return { url: signed.url, fileName: doc.fileName ?? "document" };
  }

  /** Bundle all active case documents into a zip for staff download (audited per file). */
  async getStaffBulkDownloadZip(command: {
    caseId: string;
    staffUserId: string;
    clientIp?: string | null;
  }): Promise<{ buffer: Buffer; fileName: string } | null> {
    const caseRecord = await this.caseRepo.findById(command.caseId);
    if (!caseRecord) return null;

    const docs = await this.docRepo.listActiveForCase(command.caseId);
    if (docs.length === 0) return null;

    const zipEntries: Record<string, Uint8Array> = {};
    const events = this.events;
    const maxBytes = 25 * 1024 * 1024;

    for (const doc of docs) {
      const [upload] = await this.db
        .select({ key: uploadObject.key })
        .from(uploadObject)
        .where(eq(uploadObject.id, doc.uploadObjectId))
        .limit(1);
      if (!upload) continue;

      const bytes = await this.storage.getObjectBytes(upload.key, maxBytes);
      if (!bytes) continue;

      const safeType = doc.requestedType.replace(/[^\w\s.-]/g, "_").slice(0, 80);
      const safeName = (doc.fileName ?? doc.id).replace(/[^\w\s.-]/g, "_");
      const entryName = `${safeType}/${safeName}`;
      zipEntries[entryName] = new Uint8Array(bytes);

      if (events) {
        await this.db.transaction(async (tx) => {
          await events.publish(tx, {
            aggregateType: "source_of_funds",
            aggregateId: command.caseId,
            eventType: SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT,
            actorUserId: command.staffUserId,
            payload: {
              sourceOfFundsId: command.caseId,
              documentId: doc.id,
              clientIp: command.clientIp ?? null,
              bulk: true,
            },
          });
        });
      }
    }

    if (Object.keys(zipEntries).length === 0) return null;

    const zipped = zipSync(zipEntries);
    return {
      buffer: Buffer.from(zipped),
      fileName: `source-of-funds-${command.caseId}.zip`,
    };
  }

  async listDocumentsForCase(caseId: string): Promise<AdminSourceOfFundsDocumentDto[]> {
    const docs = await this.docRepo.listActiveForCase(caseId);
    const out: AdminSourceOfFundsDocumentDto[] = [];
    for (const doc of docs) {
      const [upload] = await this.db
        .select({ key: uploadObject.key })
        .from(uploadObject)
        .where(eq(uploadObject.id, doc.uploadObjectId))
        .limit(1);
      let downloadUrl: string | null = null;
      if (upload) {
        const signed = await this.storage.createPresignedGet({
          key: upload.key,
          expiresInSec: this.downloadSigningPolicy.expiresInSec,
        });
        downloadUrl = signed.url;
      }
      out.push({
        id: doc.id,
        requestedType: doc.requestedType,
        label: doc.label,
        fileName: doc.fileName ?? null,
        reviewStatus: doc.reviewStatus,
        uploadedAt: doc.uploadedAt.toISOString(),
        uploadedByUserId: doc.uploadedByUserId,
        downloadUrl,
      });
    }
    return out;
  }

  private async buildBuyerView(
    caseRecord: SourceOfFundsCase,
    decisionOutcome: "approved" | "rejected" | null,
  ): Promise<BuyerSourceOfFundsViewDto> {
    const docs = await this.docRepo.listForCase(caseRecord.id);
    const submitted = caseRecord.documentsSubmittedAt != null;
    const summary = await this.settlementRead.summarizeForBuyersBatch([caseRecord.userId]);

    return {
      caseId: caseRecord.id,
      status: caseRecord.status,
      trigger: caseRecord.trigger,
      documentsRequested: caseRecord.documentsRequestedAt != null,
      documentsSubmitted: submitted,
      requestedDocumentTypes: caseRecord.requestedDocumentTypes ?? [],
      documentRequestNote: caseRecord.documentRequestNote,
      documents: docs.map((d) => ({
        id: d.id,
        requestedType: d.requestedType,
        label: d.label,
        fileName: d.fileName ?? null,
        statusLabel:
          d.reviewStatus === "superseded" ? "superseded" : submitted ? "under_review" : "received",
        uploadedAt: d.uploadedAt.toISOString(),
      })),
      settlementSummary: summary.get(caseRecord.userId)?.settlementSummary ?? null,
      settlementItemCount: summary.get(caseRecord.userId)?.settlementItemCount ?? 0,
      decisionOutcome,
    };
  }
}
