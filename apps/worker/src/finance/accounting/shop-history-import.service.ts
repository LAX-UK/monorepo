import {
  type AccountingDocument,
  type DocumentTarget,
  type ProjectionPolicy,
  type ShopOrderPaidFacts,
  booksTargetMode,
  documentTarget,
  parkReasonFor,
  projectShopOrderPaid,
  whenReferenceHeld,
} from "@auction/accounting-domain";
import type {
  IAccountingDocumentLookup,
  IAccountingDocumentRegistry,
  IAccountingSourceSettingReader,
  IShopAccountingFactsReader,
} from "@auction/persistence/interfaces";
import type { IBooksHistoryReader } from "../../repositories/drizzle-books-history.reader.js";

/** The source of every document the import queues: `shop_history_import:<order id>`. */
export const SHOP_HISTORY_SOURCE = "shop_history_import";

/** Each document costs Books about this many calls: create, then read back. */
export const BOOKS_CALLS_PER_DOCUMENT = 2;
/** The share of the Books daily call budget the import may use; live work keeps the rest. */
export const HISTORY_BUDGET_SHARE = 0.25;

/** How many new documents the import may queue in one UTC day, by default. */
export function historyDocumentsPerDay(dailyCallBudget: number): number {
  return Math.floor((dailyCallBudget * HISTORY_BUDGET_SHARE) / BOOKS_CALLS_PER_DOCUMENT);
}

/**
 * Only the contact and the invoice are history. The payment was taken and banked in the Xero
 * period: it is never booked again in Books (the accountant decides how the invoice shows settled).
 */
const HISTORY_KINDS: ReadonlySet<AccountingDocument["kind"]> = new Set(["contact", "invoice"]);

type Counts = { contact: number; invoice: number };
const zero = (): Counts => ({ contact: 0, invoice: 0 });

export interface ShopHistoryImportReport {
  readonly dryRun: boolean;
  readonly target: DocumentTarget;
  readonly orders: number;
  /** Queued by this run. */
  readonly queued: Counts;
  /** Dry run only: what a real run would queue. */
  readonly wouldQueue: Counts;
  /** Already in the queue for this target (an earlier run, or a contact another order made). */
  readonly alreadyQueued: Counts;
  /** Of `queued`, stored parked for a person (an outside-UK delivery). */
  readonly parked: number;
  /** Orders not imported, and why; each needs a person. */
  readonly refused: readonly { readonly orderId: string; readonly reason: string }[];
  /** Sum of the invoices' VAT-inclusive totals of the orders read, to check against Xero. */
  readonly invoiceGrossPence: number;
  readonly firstNumber: string | null;
  readonly lastNumber: string | null;
  /** The run stopped at its share of the day's call budget; run it again tomorrow. */
  readonly stoppedAtBudget: boolean;
}

export class ShopHistoryImportRefusedError extends Error {
  constructor(readonly code: string) {
    super(`shop_history_import_refused:${code}`);
    this.name = "ShopHistoryImportRefusedError";
  }
}

export interface ShopHistoryImportDeps {
  readonly history: IBooksHistoryReader;
  readonly shopFacts: IShopAccountingFactsReader;
  readonly settings: IAccountingSourceSettingReader;
  readonly registry: IAccountingDocumentRegistry;
  readonly lookup: IAccountingDocumentLookup;
  readonly now: () => Date;
  /** The Shop order policy; the live flow's by default (tests pass their own). */
  readonly policy?: ProjectionPolicy<ShopOrderPaidFacts>;
}

export interface ShopHistoryImportInput {
  /** The cutover: orders paid before it are history. */
  readonly before: Date;
  readonly since?: Date | null;
  readonly dryRun: boolean;
  /** New documents this run may queue, before what was already queued today is taken off. */
  readonly maxDocuments: number;
  readonly pageSize?: number;
}

const startOfUtcDay = (at: Date) =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));

/**
 * Queues past Shop invoices (with the Shop's own `LAX-INV-` numbers) and their buyers' contacts
 * for the Books target the Shop switch names, through the same projection policy and registry as
 * the live flow: the sender sends them with every guard it applies to new work. Registration is
 * idempotent by LAX reference and target, so a second run, or one after a crash part-way through
 * an order, queues only what is missing. Shop only: Bid starts a new series in Books (F18).
 */
export class ShopHistoryImport {
  constructor(private readonly deps: ShopHistoryImportDeps) {}

  async run(input: ShopHistoryImportInput): Promise<ShopHistoryImportReport> {
    const target = await this.shopTarget();
    const source = `${SHOP_HISTORY_SOURCE}:`;
    const usedToday = input.dryRun
      ? 0
      : await this.deps.history.documentsCreatedOn(source, startOfUtcDay(this.deps.now()));
    let budget = Math.max(0, input.maxDocuments - usedToday);
    const queued = zero();
    const wouldQueue = zero();
    const alreadyQueued = zero();
    const refused: { orderId: string; reason: string }[] = [];
    let orders = 0;
    let parked = 0;
    let invoiceGrossPence = 0;
    let firstNumber: string | null = null;
    let lastNumber: string | null = null;
    let stoppedAtBudget = false;
    let after: string | null = null;
    // A buyer with several orders has one contact: counted once per run.
    const seen = new Set<string>();

    pages: for (;;) {
      const page = await this.deps.history.paidShopOrders({
        since: input.since ?? null,
        before: input.before,
        afterInvoiceNumber: after,
        limit: input.pageSize ?? 200,
      });
      for (const order of page) {
        after = order.invoiceNumber;
        const facts = await this.deps.shopFacts.orderPaid(order.orderId);
        if (facts.status === "skip") {
          refused.push({ orderId: order.orderId, reason: facts.reason });
          continue;
        }
        const projection = (this.deps.policy ?? projectShopOrderPaid)(facts.facts);
        if (!projection.ok) {
          refused.push({ orderId: order.orderId, reason: projection.refusal.code });
          continue;
        }
        const documents = projection.value.documents.filter((d) => HISTORY_KINDS.has(d.kind));
        for (const document of documents) {
          // Never anything but the Shop's own documents: Bid history is never imported.
          if (document.product !== "shop") throw new ShopHistoryImportRefusedError("not_shop");
        }
        orders += 1;
        firstNumber ??= order.invoiceNumber;
        lastNumber = order.invoiceNumber;
        for (const d of documents)
          if (d.kind === "invoice") invoiceGrossPence += d.totals.grossPence;

        for (const document of documents) {
          if (seen.has(document.reference)) continue;
          seen.add(document.reference);
          const kind = document.kind as keyof Counts;
          const found = await this.deps.lookup.findByReference("shop", document.reference, target);
          if (!found.ok) throw new ShopHistoryImportRefusedError(found.refusal.code);
          if (found.value !== null) {
            alreadyQueued[kind] += 1;
            continue;
          }
          if (input.dryRun) {
            wouldQueue[kind] += 1;
            continue;
          }
          if (budget <= 0) {
            stoppedAtBudget = true;
            break pages;
          }
          const park = parkReasonFor(projection.value, document.reference);
          const registered = await this.deps.registry.register({
            document,
            sourceEventRef: `${source}${order.orderId}`,
            ...(park ? { park } : {}),
          });
          if (!registered.ok) {
            const kept =
              registered.refusal.code === "reference_in_use" &&
              whenReferenceHeld(document.kind) === "keep_held";
            if (kept) alreadyQueued[kind] += 1;
            else refused.push({ orderId: order.orderId, reason: registered.refusal.code });
            continue;
          }
          if (!registered.value.created) {
            alreadyQueued[kind] += 1;
            continue;
          }
          budget -= 1;
          queued[kind] += 1;
          if (park) parked += 1;
        }
      }
      if (page.length < (input.pageSize ?? 200)) break;
    }

    return {
      dryRun: input.dryRun,
      target,
      orders,
      queued,
      wouldQueue,
      alreadyQueued,
      parked,
      refused,
      invoiceGrossPence,
      firstNumber,
      lastNumber,
      stoppedAtBudget,
    };
  }

  /** The Books target the Shop switch names now; refused unless it is a Books rehearsal. */
  private async shopTarget(): Promise<DocumentTarget> {
    const config = await this.deps.settings.read();
    if (!config.ok) throw new ShopHistoryImportRefusedError(`switch_${config.refusal.code}`);
    const mode = booksTargetMode(config.value.shop);
    if (mode === null) throw new ShopHistoryImportRefusedError("shop_not_aimed_at_books");
    // Rehearsal only in this release: the live organisation is wired by a later change.
    if (mode === "live") throw new ShopHistoryImportRefusedError("books_live_not_in_rehearsal");
    return documentTarget(config.value.shop) as DocumentTarget;
  }
}
