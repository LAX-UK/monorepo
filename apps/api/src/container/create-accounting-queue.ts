import type { Database } from "@auction/db";
import {
  AccountingQueueService,
  type IAccountingQueueService,
  createBooksDocumentLinks,
} from "@auction/finance-runtime";
import type { IAccountingDocumentBrowser } from "@auction/persistence/interfaces";
import { createAccountingRepositories } from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { DomainEventAccountingAuditTrail } from "../services/admin/accounting/accounting-audit-trail.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";

export type ContainerAccountingQueue = {
  accountingQueue: IAccountingQueueService;
  /** The same reader, for the Books source on the Failed jobs page. */
  accountingBrowser: IAccountingDocumentBrowser;
};

/**
 * Finance › Accounting: reads the accounting documents and requeues one when staff try it again.
 * Nothing here sends to Books; the worker's sender does, in the mode each document was made for.
 */
export function createAccountingQueue(input: {
  db: Database;
  domainEventSink: IDomainEventSink;
  env: Pick<Env, "ZOHO_BOOKS_ORG_CONFIG">;
}): ContainerAccountingQueue {
  const repos = createAccountingRepositories(input.db, { now: () => new Date() });
  return {
    accountingQueue: new AccountingQueueService({
      browser: repos.browser,
      partFunded: repos.partFunded,
      transitions: repos.transitions,
      audit: new DomainEventAccountingAuditTrail(input.domainEventSink),
      booksLink: createBooksDocumentLinks(input.env),
    }),
    accountingBrowser: repos.browser,
  };
}
