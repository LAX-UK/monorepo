import type { Database } from "@auction/db";
import { uploadObject } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  BuyerSourceOfFundsViewDto,
  ISourceOfFundsDocumentCollectionBuyerService,
} from "../interfaces/source-of-funds-document-collection.js";
import {
  SOURCE_OF_FUNDS_DOCUMENTS_SUBMITTED_EVENT,
  SOURCE_OF_FUNDS_DOCUMENT_UPLOADED_EVENT,
  type SourceOfFundsDocumentCollectionContext,
} from "./source-of-funds-document-collection-context.js";
import type { SourceOfFundsCase, SourceOfFundsDocumentRow } from "./source-of-funds.types.js";

export class SourceOfFundsDocumentCollectionBuyerService
  implements ISourceOfFundsDocumentCollectionBuyerService
{
  constructor(private readonly ctx: SourceOfFundsDocumentCollectionContext) {}

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
      const existing = await this.ctx.caseRepo.findById(command.caseId, conn);
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

      const supersededIds = await this.ctx.docRepo.supersedeActiveForType(
        command.caseId,
        requestedType,
        conn,
      );
      if (supersededIds.length > 0) {
        await this.ctx.reviewRepo.deleteForDocuments(supersededIds, conn);
      }
      const doc = await this.ctx.docRepo.attach(
        {
          sourceOfFundsId: command.caseId,
          uploadObjectId: command.uploadObjectId,
          requestedType,
          label: command.label,
          uploadedByUserId: command.buyerUserId,
        },
        conn,
      );

      if (this.ctx.events) {
        await this.ctx.events.withTx(conn).publish({
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

    return this.ctx.transactionRunner.runInTransaction((tx) => run(tx));
  }

  async submitDocuments(command: {
    caseId: string;
    buyerUserId: string;
  }): Promise<SourceOfFundsCase> {
    const run = async (conn: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.ctx.caseRepo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.userId !== command.buyerUserId) throw new Error("source_of_funds_forbidden");
      if (!existing.documentsRequestedAt)
        throw new Error("source_of_funds_documents_not_requested");
      if (existing.documentsSubmittedAt)
        throw new Error("source_of_funds_documents_already_submitted");

      const count = await this.ctx.docRepo.countActiveForCase(command.caseId, conn);
      if (count === 0) throw new Error("source_of_funds_no_documents_to_submit");

      const updated = await this.ctx.caseRepo.setDocumentsSubmitted(command.caseId, conn);
      if (!updated) throw new Error("source_of_funds_submit_failed");

      if (this.ctx.events) {
        await this.ctx.events.withTx(conn).publish({
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

    return this.ctx.transactionRunner.runInTransaction((tx) => run(tx));
  }

  async getBuyerView(buyerUserId: string): Promise<BuyerSourceOfFundsViewDto | null> {
    const caseRecord = await this.ctx.caseRepo.findLatestForUser(buyerUserId);
    if (!caseRecord) return null;
    if (caseRecord.status === "approved") {
      return this.buildBuyerView(caseRecord, "approved");
    }
    if (caseRecord.status === "rejected") {
      return this.buildBuyerView(caseRecord, "rejected");
    }
    return this.buildBuyerView(caseRecord, null);
  }

  private async buildBuyerView(
    caseRecord: SourceOfFundsCase,
    decisionOutcome: "approved" | "rejected" | null,
  ): Promise<BuyerSourceOfFundsViewDto> {
    const docs = await this.ctx.docRepo.listForCase(caseRecord.id);
    const submitted = caseRecord.documentsSubmittedAt != null;
    const summary = await this.ctx.settlementRead.summarizeForBuyersBatch([caseRecord.userId]);

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
