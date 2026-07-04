import type { ISourceOfFundsDocumentPurgeRepository } from "../interfaces/source-of-funds-document-purge.repository.js";
import type { UploadStorage } from "../lib/upload-storage.js";

/** Default AML retention: 5 years after case resolution. */
const DEFAULT_RETENTION_YEARS = 5;

export async function purgeSourceOfFundsDocumentsJob(input: {
  sourceOfFundsDocumentPurgeRepo: ISourceOfFundsDocumentPurgeRepository;
  storage: UploadStorage;
  log: { info: (o: unknown, msg?: string) => void };
  retentionYears?: number;
  now?: Date;
}): Promise<{ purged: number }> {
  const now = input.now ?? new Date();
  const retentionMs =
    (input.retentionYears ?? DEFAULT_RETENTION_YEARS) * 365.25 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - retentionMs);

  const terminalCases = await input.sourceOfFundsDocumentPurgeRepo.findTerminalCasesPastRetention(
    cutoff,
    100,
  );

  if (terminalCases.length === 0) {
    input.log.info({ purged: 0 }, "purge_source_of_funds_documents");
    return { purged: 0 };
  }

  const caseIds = terminalCases.map((c) => c.id);
  const docs = await input.sourceOfFundsDocumentPurgeRepo.findDocumentsToPurge(caseIds, 500);

  let purged = 0;
  for (const doc of docs) {
    try {
      await input.storage.deleteObject(doc.key);
    } catch {
      /* best-effort */
    }
    await input.sourceOfFundsDocumentPurgeRepo.anonymizeDocument(doc.id, now);
    await input.sourceOfFundsDocumentPurgeRepo.deleteDocumentReviews(doc.id);
    purged += 1;
  }

  input.log.info({ purged, caseCount: caseIds.length }, "purge_source_of_funds_documents");
  return { purged };
}
