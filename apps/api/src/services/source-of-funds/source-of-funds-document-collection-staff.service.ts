import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { zipSync } from "fflate";
import type {
  AdminSourceOfFundsDocumentDto,
  ISourceOfFundsDocumentCollectionStaffService,
} from "../interfaces/source-of-funds-document-collection.js";
import {
  SOURCE_OF_FUNDS_DOCUMENTS_REQUESTED_EVENT,
  SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT,
  type SourceOfFundsDocumentCollectionContext,
  clampStaffPreviewContentType,
  sanitizeSourceOfFundsFilename,
} from "./source-of-funds-document-collection-context.js";
import type { SourceOfFundsCase } from "./source-of-funds.types.js";

export class SourceOfFundsDocumentCollectionStaffService
  implements ISourceOfFundsDocumentCollectionStaffService
{
  constructor(private readonly ctx: SourceOfFundsDocumentCollectionContext) {}

  async requestDocuments(command: {
    caseId: string;
    staffUserId: string;
    documentTypes: string[];
    note: string | null;
  }): Promise<SourceOfFundsCase> {
    const types = [...new Set(command.documentTypes.map((t) => t.trim()).filter(Boolean))];
    if (types.length === 0) throw new Error("source_of_funds_document_types_required");

    const run = async (conn: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.ctx.caseRepo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.status !== "pending") throw new Error("source_of_funds_not_pending");
      if (existing.documentsRequestedAt && !existing.documentsSubmittedAt) {
        throw new Error("source_of_funds_documents_already_requested");
      }

      const updated = await this.ctx.caseRepo.setDocumentRequest(
        {
          id: command.caseId,
          requestedByUserId: command.staffUserId,
          documentTypes: types,
          note: command.note,
        },
        conn,
      );
      if (!updated) throw new Error("source_of_funds_request_failed");

      if (this.ctx.events) {
        await this.ctx.events.publish(conn, {
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

    return this.ctx.db.transaction((tx) => run(tx));
  }

  async getStaffDownloadUrl(command: {
    caseId: string;
    documentId: string;
    staffUserId: string;
    clientIp?: string | null;
    preview?: boolean;
  }): Promise<{ url: string; fileName: string } | null> {
    const caseRecord = await this.ctx.caseRepo.findById(command.caseId);
    if (!caseRecord) return null;

    const doc = await this.ctx.docRepo.findById(command.documentId);
    if (!doc || doc.sourceOfFundsId !== command.caseId) return null;
    if (doc.reviewStatus === "superseded") return null;

    const [upload] = await this.ctx.db
      .select({ key: uploadObject.key })
      .from(uploadObject)
      .where(eq(uploadObject.id, doc.uploadObjectId))
      .limit(1);
    if (!upload) return null;

    const signed = await this.ctx.storage.createPresignedGet({
      key: upload.key,
      expiresInSec: this.ctx.downloadSigningPolicy.expiresInSec,
      responseContentDisposition: command.preview
        ? `inline; filename="${sanitizeSourceOfFundsFilename(doc.fileName ?? "document")}"`
        : `attachment; filename="${sanitizeSourceOfFundsFilename(doc.fileName ?? "document")}"`,
    });

    await this.auditDownload(command);
    return { url: signed.url, fileName: doc.fileName ?? "document" };
  }

  async getStaffPreviewBytes(command: {
    caseId: string;
    documentId: string;
    staffUserId: string;
    clientIp?: string | null;
    maxBytes?: number;
  }): Promise<{ buffer: Buffer; contentType: string; fileName: string } | null> {
    const caseRecord = await this.ctx.caseRepo.findById(command.caseId);
    if (!caseRecord) return null;

    const doc = await this.ctx.docRepo.findById(command.documentId);
    if (!doc || doc.sourceOfFundsId !== command.caseId) return null;
    if (doc.reviewStatus === "superseded") return null;

    const [upload] = await this.ctx.db
      .select({ key: uploadObject.key })
      .from(uploadObject)
      .where(eq(uploadObject.id, doc.uploadObjectId))
      .limit(1);
    if (!upload) return null;

    const head = await this.ctx.storage.headObject(upload.key);
    if (!head) return null;

    const maxBytes = command.maxBytes ?? 25 * 1024 * 1024;
    const bytes = await this.ctx.storage.getObjectBytes(upload.key, maxBytes);
    if (!bytes) return null;

    await this.auditDownload({ ...command, preview: true });

    return {
      buffer: bytes,
      contentType: clampStaffPreviewContentType(head.contentType),
      fileName: doc.fileName ?? "document",
    };
  }

  async getStaffBulkDownloadZip(command: {
    caseId: string;
    staffUserId: string;
    clientIp?: string | null;
  }): Promise<{ buffer: Buffer; fileName: string } | null> {
    const caseRecord = await this.ctx.caseRepo.findById(command.caseId);
    if (!caseRecord) return null;

    const docs = await this.ctx.docRepo.listActiveForCase(command.caseId);
    if (docs.length === 0) return null;

    const zipEntries: Record<string, Uint8Array> = {};
    const maxBytes = 25 * 1024 * 1024;

    for (const doc of docs) {
      const [upload] = await this.ctx.db
        .select({ key: uploadObject.key })
        .from(uploadObject)
        .where(eq(uploadObject.id, doc.uploadObjectId))
        .limit(1);
      if (!upload) continue;

      const bytes = await this.ctx.storage.getObjectBytes(upload.key, maxBytes);
      if (!bytes) continue;

      const safeType = doc.requestedType.replace(/[^\w\s.-]/g, "_").slice(0, 80);
      const safeName = (doc.fileName ?? doc.id).replace(/[^\w\s.-]/g, "_");
      const entryName = `${safeType}/${safeName}`;
      zipEntries[entryName] = new Uint8Array(bytes);

      await this.auditBulkDownload(command, doc.id);
    }

    if (Object.keys(zipEntries).length === 0) return null;

    const zipped = zipSync(zipEntries);
    return {
      buffer: Buffer.from(zipped),
      fileName: `source-of-funds-${command.caseId}.zip`,
    };
  }

  async listDocumentsForCase(caseId: string): Promise<AdminSourceOfFundsDocumentDto[]> {
    const docs = await this.ctx.docRepo.listActiveForCase(caseId);
    return docs.map((doc) => ({
      id: doc.id,
      requestedType: doc.requestedType,
      label: doc.label,
      fileName: doc.fileName ?? null,
      reviewStatus: doc.reviewStatus,
      uploadedAt: doc.uploadedAt.toISOString(),
      uploadedByUserId: doc.uploadedByUserId,
      downloadUrl: null,
    }));
  }

  private async auditDownload(command: {
    caseId: string;
    documentId: string;
    staffUserId: string;
    clientIp?: string | null;
    preview?: boolean;
  }): Promise<void> {
    const events = this.ctx.events;
    if (!events) return;
    await this.ctx.db.transaction(async (tx) => {
      await events.publish(tx, {
        aggregateType: "source_of_funds",
        aggregateId: command.caseId,
        eventType: SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT,
        actorUserId: command.staffUserId,
        payload: {
          sourceOfFundsId: command.caseId,
          documentId: command.documentId,
          clientIp: command.clientIp ?? null,
          ...(command.preview ? { preview: true } : {}),
        },
      });
    });
  }

  private async auditBulkDownload(
    command: { caseId: string; staffUserId: string; clientIp?: string | null },
    documentId: string,
  ): Promise<void> {
    const events = this.ctx.events;
    if (!events) return;
    await this.ctx.db.transaction(async (tx) => {
      await events.publish(tx, {
        aggregateType: "source_of_funds",
        aggregateId: command.caseId,
        eventType: SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT,
        actorUserId: command.staffUserId,
        payload: {
          sourceOfFundsId: command.caseId,
          documentId,
          clientIp: command.clientIp ?? null,
          bulk: true,
        },
      });
    });
  }
}
