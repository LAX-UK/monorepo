import type { Database } from "@auction/db";
import type {
  AccountingClock,
  IAccountingAttentionReader,
  IAccountingDocumentBrowser,
  IAccountingDocumentDueWork,
  IAccountingDocumentLookup,
  IAccountingDocumentRegistry,
  IAccountingDocumentTransitions,
  IAccountingDocumentWorkQueue,
  IAccountingSourceSettingReader,
  IAccountingSourceSettingWriter,
} from "../../interfaces/accounting.js";
import { DrizzleAccountingAttentionReader } from "./drizzle-accounting-attention.reader.js";
import { DrizzleAccountingDocumentBrowser } from "./drizzle-accounting-document.browser.js";
import { DrizzleAccountingDocumentDueWork } from "./drizzle-accounting-document.due-work.js";
import { DrizzleAccountingDocumentReader } from "./drizzle-accounting-document.reader.js";
import { DrizzleAccountingDocumentRegistry } from "./drizzle-accounting-document.registry.js";
import { DrizzleAccountingDocumentTransitions } from "./drizzle-accounting-document.transitions.js";
import { DrizzleAccountingDocumentWorkQueue } from "./drizzle-accounting-document.work-queue.js";
import { DrizzleAccountingSourceSettingReader } from "./drizzle-accounting-source-setting.reader.js";
import { DrizzleAccountingSourceSettingWriter } from "./drizzle-accounting-source-setting.writer.js";

/** Each role's process takes the ports it is granted; the interfaces are what callers depend on. */
export interface AccountingRepositories {
  readonly lookup: IAccountingDocumentLookup;
  readonly registry: IAccountingDocumentRegistry;
  readonly transitions: IAccountingDocumentTransitions;
  readonly workQueue: IAccountingDocumentWorkQueue;
  readonly dueWork: IAccountingDocumentDueWork;
  readonly settingReader: IAccountingSourceSettingReader;
  readonly settingWriter: IAccountingSourceSettingWriter;
  readonly browser: IAccountingDocumentBrowser;
  readonly attention: IAccountingAttentionReader;
}

/** The one place the accounting repositories are assembled (container registration). */
export function createAccountingRepositories(
  db: Database,
  clock: AccountingClock,
): AccountingRepositories {
  return {
    lookup: new DrizzleAccountingDocumentReader(db, clock),
    registry: new DrizzleAccountingDocumentRegistry(db, clock),
    transitions: new DrizzleAccountingDocumentTransitions(db, clock),
    workQueue: new DrizzleAccountingDocumentWorkQueue(db, clock),
    dueWork: new DrizzleAccountingDocumentDueWork(db, clock),
    settingReader: new DrizzleAccountingSourceSettingReader(db),
    settingWriter: new DrizzleAccountingSourceSettingWriter(db, clock),
    browser: new DrizzleAccountingDocumentBrowser(db, clock),
    attention: new DrizzleAccountingAttentionReader(db),
  };
}
