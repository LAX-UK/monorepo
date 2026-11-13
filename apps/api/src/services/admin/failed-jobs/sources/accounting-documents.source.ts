import { queueTabFor } from "@auction/accounting-domain";
import type {
  IAccountingDocumentBrowser,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import {
  ACCOUNTING_DOCUMENT_TYPE_LABELS,
  FAILED_JOB_ID_PREFIXES,
  type FailedJobDetail,
  type FailedJobSummary,
  accountingProblemText,
} from "@auction/types";
import type {
  FailedJobSourceAdapter,
  ReviewTarget,
  SourceListQuery,
  SourceListResult,
} from "./failed-job-source.js";

export type AccountingDocumentsSourceDeps = {
  browser: IAccountingDocumentBrowser;
};

/** The one "Job type" this source offers. */
export const BOOKS_QUEUE_ID = "accounting:books";
const BOOKS_QUEUE_LABEL = "Zoho Books documents";
const SOURCE = "integrations.books" as const;
const EMPTY_COUNTS = { needs_review: 0, retried: 0, discarded: 0 } as const;

/** Where staff handle these documents; the screen links each row there. */
const HANDLED_ON = "Try it again from Finance › Accounting.";

/** When Books first had trouble with the document: when it entered the queue. */
function firstFailedAt(document: StoredAccountingDocument): string {
  return document.createdAt.toISOString();
}

/** When Books last had trouble with it: its last change. */
function lastFailedAt(document: StoredAccountingDocument): string {
  return document.updatedAt.toISOString();
}

function reasonOf(document: StoredAccountingDocument): string {
  const { record } = document;
  if (record.status === "failed" || record.status === "needs_review") return record.reason;
  return document.lastErrorClass ?? "";
}

/**
 * Books documents that were refused or need a person, shown beside the other failures so nothing
 * is missed. They are read here only: trying one again is done on Finance › Accounting, which keeps
 * the same LAX reference. So rows carry no retry or discard, and only "Needs review" has any.
 */
export class AccountingDocumentsSource implements FailedJobSourceAdapter {
  readonly family = "integrations" as const;

  constructor(private readonly deps: AccountingDocumentsSourceDeps) {}

  owns(id: string): boolean {
    return id.startsWith(FAILED_JOB_ID_PREFIXES.accounting);
  }

  ownsQueue(queue: string): boolean {
    return queue === BOOKS_QUEUE_ID;
  }

  async list(query: SourceListQuery): Promise<SourceListResult> {
    if (!query.viewer.read.has(SOURCE)) {
      return { readable: false, rows: [], total: 0, counts: { ...EMPTY_COUNTS }, queues: [] };
    }
    // Both tabs are read up to the end of the requested window, merged, then cut to the window.
    const window = query.offset + query.limit;
    const [failed, person] = await Promise.all(
      (["failed", "needs_person"] as const).map((tab) =>
        this.deps.browser.list({ tab, legalEntity: null, limit: window, offset: 0 }),
      ),
    );
    const waiting = (failed?.counts.failed ?? 0) + (failed?.counts.needs_person ?? 0);
    const counts = { ...EMPTY_COUNTS, needs_review: waiting };
    const queues = [{ id: BOOKS_QUEUE_ID, label: BOOKS_QUEUE_LABEL, count: waiting }];
    if (query.view !== "needs_review") {
      return { readable: true, rows: [], total: 0, counts, queues };
    }
    const direction = query.sort === "failed_asc" ? 1 : -1;
    const rows = [...(failed?.documents ?? []), ...(person?.documents ?? [])]
      .map((document) => this.summary(document))
      .filter((row) => matches(row, query))
      .sort(
        (a, b) =>
          direction *
          (a.lastFailedAt < b.lastFailedAt ? -1 : a.lastFailedAt > b.lastFailedAt ? 1 : 0),
      );
    const filtered = Boolean(query.q || query.fromDay || query.toDay);
    return {
      readable: true,
      rows: rows.slice(query.offset, window),
      total: filtered ? rows.length : waiting,
      counts,
      queues,
    };
  }

  /** Opened on Finance › Accounting, never here. */
  async detail(): Promise<FailedJobDetail | null> {
    return null;
  }

  /** Nothing to retry or discard here; a batch that names one is told it was not found. */
  async find(): Promise<ReviewTarget[]> {
    return [];
  }

  private summary(document: StoredAccountingDocument): FailedJobSummary {
    return {
      // `accounting:<tab>:<id>`, so the screen opens the Accounting tab the document is in.
      id: `${FAILED_JOB_ID_PREFIXES.accounting}${queueTabFor(document.record) ?? "failed"}:${document.id}`,
      source: SOURCE,
      canAct: false,
      queue: BOOKS_QUEUE_ID,
      typeLabel: `${ACCOUNTING_DOCUMENT_TYPE_LABELS[document.kind]} to Zoho Books`,
      jobLabel: document.reference,
      sourceLabel: "Integrations · Zoho Books",
      errorSummary: accountingProblemText(reasonOf(document)),
      attempts: document.record.attempts,
      firstFailedAt: firstFailedAt(document),
      lastFailedAt: lastFailedAt(document),
      state: "needs_review",
      mayRepeat: false,
      retry: { allowed: false, reason: HANDLED_ON },
    };
  }
}

function matches(row: FailedJobSummary, query: SourceListQuery): boolean {
  const day = row.lastFailedAt.slice(0, 10);
  if (query.fromDay && day < query.fromDay) return false;
  if (query.toDay && day > query.toDay) return false;
  if (query.q) {
    const q = query.q.toLowerCase();
    const text = `${row.jobLabel ?? ""} ${row.typeLabel} ${row.errorSummary}`.toLowerCase();
    if (!text.includes(q)) return false;
  }
  return true;
}
