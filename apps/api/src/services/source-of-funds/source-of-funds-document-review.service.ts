import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { ISourceOfFundsDocumentReviewRepository, SourceOfFundsDocumentReviewRow } from "@auction/persistence/interfaces";
import type { ISourceOfFundsDocumentRepository } from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  ISourceOfFundsDocumentReviewService,
  ReviewSourceOfFundsDocumentCommand,
} from "../interfaces/source-of-funds-document-review.js";
import type { ISourceOfFundsRepository } from "./source-of-funds.types.js";

export const SOURCE_OF_FUNDS_DOCUMENT_REVIEWED_EVENT = "source_of_funds.document_reviewed";

export type { ReviewSourceOfFundsDocumentCommand } from "../interfaces/source-of-funds-document-review.js";

const NOTES_MAX = 2000;

export class SourceOfFundsDocumentReviewService implements ISourceOfFundsDocumentReviewService {
  constructor(
    private readonly caseRepo: ISourceOfFundsRepository,
    private readonly docRepo: ISourceOfFundsDocumentRepository,
    private readonly reviewRepo: ISourceOfFundsDocumentReviewRepository,
    private readonly transactionRunner: ITransactionRunner,
    private readonly events: IDomainEventSink | null,
  ) {}

  async reviewDocument(
    command: ReviewSourceOfFundsDocumentCommand,
  ): Promise<SourceOfFundsDocumentReviewRow> {
    const note = command.note?.trim().slice(0, NOTES_MAX) ?? null;
    const checks = normalizeChecks(command.checks);

    const run = async (conn: Database): Promise<SourceOfFundsDocumentReviewRow> => {
      const caseRecord = await this.caseRepo.findById(command.caseId, conn);
      if (!caseRecord) throw new Error("source_of_funds_not_found");
      if (caseRecord.status !== "pending") throw new Error("source_of_funds_not_pending");

      const doc = await this.docRepo.findById(command.documentId, conn);
      if (!doc || doc.sourceOfFundsId !== command.caseId) {
        throw new Error("source_of_funds_document_not_found");
      }
      if (doc.reviewStatus === "superseded") {
        throw new Error("source_of_funds_document_superseded");
      }

      const reviewedAt = new Date();
      const row = await this.reviewRepo.upsertLatest(
        {
          documentId: command.documentId,
          sourceOfFundsId: command.caseId,
          reviewedByUserId: command.staffUserId,
          reviewedAt,
          checks,
          note,
        },
        conn,
      );

      if (this.events) {
        await this.events.withTx(conn).publish({
          aggregateType: "source_of_funds",
          aggregateId: command.caseId,
          eventType: SOURCE_OF_FUNDS_DOCUMENT_REVIEWED_EVENT,
          actorUserId: command.staffUserId,
          payload: {
            sourceOfFundsId: command.caseId,
            documentId: command.documentId,
            checks,
            note,
            reviewedByUserId: command.staffUserId,
            reviewedAt: reviewedAt.toISOString(),
          },
        });
      }

      return row;
    };

    return this.transactionRunner.runInTransaction((tx) => run(tx));
  }
}

function normalizeChecks(
  input: ReviewSourceOfFundsDocumentCommand["checks"],
): ReviewSourceOfFundsDocumentCommand["checks"] {
  return {
    matchesDeclaredSource: Boolean(input.matchesDeclaredSource),
    coversExposure: Boolean(input.coversExposure),
    recentEnough: Boolean(input.recentEnough),
    legibleComplete: Boolean(input.legibleComplete),
  };
}
