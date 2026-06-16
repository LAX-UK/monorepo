import type { Database } from "@auction/db";
import {
  sourceOfFunds,
  sourceOfFundsDocument,
  sourceOfFundsDocumentReview,
  uploadObject,
} from "@auction/db/schema";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { UploadStorage } from "../lib/upload-storage.js";

/** Default AML retention: 5 years after case resolution. */
const DEFAULT_RETENTION_YEARS = 5;

export async function purgeSourceOfFundsDocumentsJob(input: {
  db: Database;
  storage: UploadStorage;
  log: { info: (o: unknown, msg?: string) => void };
  retentionYears?: number;
  now?: Date;
}): Promise<{ purged: number }> {
  const now = input.now ?? new Date();
  const retentionMs =
    (input.retentionYears ?? DEFAULT_RETENTION_YEARS) * 365.25 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - retentionMs);

  const terminalCases = await input.db
    .select({ id: sourceOfFunds.id, reviewedAt: sourceOfFunds.reviewedAt })
    .from(sourceOfFunds)
    .where(
      and(
        or(eq(sourceOfFunds.status, "approved"), eq(sourceOfFunds.status, "rejected")),
        lt(sourceOfFunds.reviewedAt, cutoff),
      ),
    )
    .limit(100);

  if (terminalCases.length === 0) {
    input.log.info({ purged: 0 }, "purge_source_of_funds_documents");
    return { purged: 0 };
  }

  const caseIds = terminalCases.map((c) => c.id);
  const docs = await input.db
    .select({
      id: sourceOfFundsDocument.id,
      uploadObjectId: sourceOfFundsDocument.uploadObjectId,
      key: uploadObject.key,
    })
    .from(sourceOfFundsDocument)
    .innerJoin(uploadObject, eq(uploadObject.id, sourceOfFundsDocument.uploadObjectId))
    .where(
      and(
        inArray(sourceOfFundsDocument.sourceOfFundsId, caseIds),
        isNull(sourceOfFundsDocument.anonymizedAt),
      ),
    )
    .limit(500);

  let purged = 0;
  for (const doc of docs) {
    try {
      await input.storage.deleteObject(doc.key);
    } catch {
      /* best-effort */
    }
    await input.db
      .update(sourceOfFundsDocument)
      .set({
        anonymizedAt: now,
        label: null,
        reviewStatus: "superseded",
      })
      .where(eq(sourceOfFundsDocument.id, doc.id));
    await input.db
      .delete(sourceOfFundsDocumentReview)
      .where(eq(sourceOfFundsDocumentReview.documentId, doc.id));
    purged += 1;
  }

  input.log.info({ purged, caseCount: caseIds.length }, "purge_source_of_funds_documents");
  return { purged };
}
