import {
  type Product,
  type StripeAttribution,
  type StripeBalanceTransactionFacts,
  booksTargetMode,
  decideStripeBalanceTransaction,
  legalEntityFor,
} from "@auction/accounting-domain";
import { LONDON_TIME_ZONE, dayKey, startOfDay } from "@auction/datetime";
import type {
  IAccountingSourceSettingReader,
  IStripeBooksLedger,
  StripeAccountState,
  StripeBalanceOutcome,
  StripeBalanceRow,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import type { StripeBalanceItem, StripeBalanceReader } from "./stripe-balance-reader.js";

/** The London calendar day of an instant, `YYYY-MM-DD`. */
export function londonDay(at: Date): string {
  return dayKey(at, LONDON_TIME_ZONE);
}

/** The instant a London calendar day starts. */
export function startOfLondonDay(day: string): Date {
  // Noon UTC of that date is always on that London day, whatever the clocks do.
  return startOfDay(new Date(`${day}T12:00:00Z`), LONDON_TIME_ZONE);
}

/** Stripe's own fee types and the payout types: their company is the account's own row. */
const ACCOUNT_OWN_TYPES = new Set([
  "payout",
  "payout_cancel",
  "payout_failure",
  "stripe_fee",
  "stripe_fx_fee",
  "tax_fee",
]);
const PAYOUT_TYPES = new Set(["payout", "payout_cancel", "payout_failure"]);

export interface StripeBooksSyncDeps {
  readonly ledger: IStripeBooksLedger;
  readonly settings: IAccountingSourceSettingReader;
  /** One reader per Stripe key the worker holds (Bid's account, the Shop's). */
  readonly readers: readonly StripeBalanceReader[];
  readonly now: () => Date;
  readonly log: Pick<Logger, "info" | "warn">;
  /** Balance transactions per page (Stripe allows 1-100). */
  readonly pageSize?: number;
  /** The widest window read before the cursor moves on. */
  readonly windowMs?: number;
  /**
   * How far behind now a run reads: a balance transaction of the last minutes may not be listed
   * yet, so the cursor never passes them.
   */
  readonly settleMs?: number;
}

export interface StripeBooksSyncSummary {
  readonly accounts: number;
  readonly pages: number;
  readonly read: number;
  readonly recorded: number;
  readonly alreadyRecorded: number;
  readonly booked: number;
  readonly parked: number;
  readonly notAimed: number;
}

const DAY_MS = 24 * 60 * 60_000;

/**
 * The daily Stripe fees and payouts job (plan flow 25). For each Stripe account the worker reads
 * and LAX has a row for, it reads every balance transaction created since the stored cursor, a
 * window at a time and page by page, and decides each one with the domain's policy: Stripe's fee
 * becomes an expense paid from Stripe clearing, a payout a transfer from clearing to the bank.
 * Which company a transaction belongs to comes only from stored LAX rows (the account's own row
 * for payouts and Stripe's own fees; the stored payment, payment group or Shop order for anything
 * from a charge); anything else is parked for a person. Each transaction is recorded with its
 * documents in one database transaction, keyed on its Stripe id, so a re-run or a second run at
 * the same time books nothing twice. The cursor moves only once a window is fully recorded. Only
 * reads Stripe.
 */
export class StripeBooksSync {
  private readonly pageSize: number;
  private readonly windowMs: number;
  private readonly settleMs: number;

  constructor(private readonly deps: StripeBooksSyncDeps) {
    this.pageSize = deps.pageSize ?? 100;
    this.windowMs = deps.windowMs ?? DAY_MS;
    this.settleMs = deps.settleMs ?? 10 * 60_000;
  }

  async run(): Promise<StripeBooksSyncSummary> {
    const config = await this.deps.settings.read();
    if (!config.ok) throw new Error(`accounting_switch_unreadable:${config.refusal.code}`);
    const accounts = new Map(
      (await this.deps.ledger.accounts()).map((a) => [a.stripeAccountId, a]),
    );
    const totals = {
      accounts: 0,
      pages: 0,
      read: 0,
      recorded: 0,
      alreadyRecorded: 0,
      booked: 0,
      parked: 0,
      notAimed: 0,
    };
    for (const reader of this.deps.readers) {
      const accountId = await reader.accountId();
      const account = accounts.get(accountId);
      if (!account) {
        // Never guessed: a Stripe account no LAX row names is not read at all.
        this.deps.log.warn(
          { stripeAccountId: accountId },
          "accounting_stripe_account_not_registered",
        );
        continue;
      }
      const start =
        account.readThrough ?? (account.opening ? startOfLondonDay(account.opening.on) : null);
      if (!start) {
        this.deps.log.warn({ stripeAccountId: accountId }, "accounting_stripe_account_no_opening");
        continue;
      }
      totals.accounts += 1;
      await this.readAccount(
        reader,
        account,
        start,
        (product) => booksTargetMode(config.value[product]) !== null,
        totals,
      );
    }
    this.deps.log.info(totals, "accounting_stripe_sync_done");
    return totals;
  }

  private async readAccount(
    reader: StripeBalanceReader,
    account: StripeAccountState,
    start: Date,
    aimed: (product: Product) => boolean,
    totals: { -readonly [K in keyof StripeBooksSyncSummary]: number },
  ): Promise<void> {
    const upper = new Date(Math.floor((this.deps.now().getTime() - this.settleMs) / 1000) * 1000);
    let from = new Date(Math.floor(start.getTime() / 1000) * 1000);
    while (from < upper) {
      const to = new Date(Math.min(from.getTime() + this.windowMs, upper.getTime()));
      const items = await this.readWindow(reader, from, to, totals);
      // Oldest first, so the documents of a day are registered in the order Stripe made them.
      items.sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      for (const item of items) {
        totals.read += 1;
        const row = this.rowOf(account.stripeAccountId, item);
        const outcome = await this.decide(account, item, row, aimed);
        const result = await this.deps.ledger.record(row, outcome);
        if (result === "already_recorded") {
          totals.alreadyRecorded += 1;
          continue;
        }
        totals.recorded += 1;
        if (outcome.outcome === "booked") totals.booked += 1;
        if (outcome.outcome === "parked") totals.parked += 1;
        if (outcome.outcome === "not_aimed") totals.notAimed += 1;
      }
      await this.deps.ledger.advanceCursor(account.stripeAccountId, to);
      from = to;
    }
  }

  /** Every page of one window. Stripe lists newest first; `starting_after` walks back. */
  private async readWindow(
    reader: StripeBalanceReader,
    from: Date,
    to: Date,
    totals: { pages: number },
  ): Promise<StripeBalanceItem[]> {
    const items: StripeBalanceItem[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await reader.listBalanceTransactions({
        createdGte: from.getTime() / 1000,
        createdLt: to.getTime() / 1000,
        limit: this.pageSize,
        ...(after ? { startingAfter: after } : {}),
      });
      totals.pages += 1;
      items.push(...page.data);
      const last = page.data.at(-1);
      if (!page.hasMore || !last) return items;
      after = last.id;
    }
  }

  private rowOf(stripeAccountId: string, item: StripeBalanceItem): StripeBalanceRow {
    const createdAt = new Date(item.created * 1000);
    return {
      stripeAccountId,
      id: item.id,
      type: item.type,
      currency: item.currency,
      amountPence: item.amount,
      feePence: item.fee,
      createdAt,
      createdOn: londonDay(createdAt),
      sourceId: item.source?.id ?? null,
      payoutId: PAYOUT_TYPES.has(item.type) ? (item.source?.id ?? null) : null,
    };
  }

  /** Which company, from stored rows only. */
  private async attribute(
    account: StripeAccountState,
    item: StripeBalanceItem,
  ): Promise<StripeAttribution> {
    if (ACCOUNT_OWN_TYPES.has(item.type)) return { status: "attributed", product: account.product };
    const source = item.source;
    if (!source) return { status: "unattributable" };
    const products = [
      ...new Set(
        await this.deps.ledger.productsForCharge({
          paymentIntentId: source.paymentIntentId,
          chargeId: source.chargeId,
        }),
      ),
    ];
    if (products.length === 0) return { status: "unattributable" };
    const [product] = products as [Product, ...Product[]];
    // Two companies' rows, or one company's charge in the other company's Stripe account.
    if (products.length > 1 || legalEntityFor(product) !== legalEntityFor(account.product)) {
      return { status: "conflict" };
    }
    return { status: "attributed", product };
  }

  private async decide(
    account: StripeAccountState,
    item: StripeBalanceItem,
    row: StripeBalanceRow,
    aimed: (product: Product) => boolean,
  ): Promise<StripeBalanceOutcome> {
    const facts: StripeBalanceTransactionFacts = {
      id: item.id,
      type: item.type,
      currency: item.currency,
      amountPence: item.amount,
      feePence: item.fee,
      createdOn: row.createdOn,
      payoutId: row.payoutId,
    };
    // A transaction with nothing to book needs no company; look it up only when it has.
    const blind = decideStripeBalanceTransaction(facts, { status: "unattributable" });
    if (blind.ok && blind.value.action === "nothing") return { outcome: "nothing", product: null };
    const attribution = await this.attribute(account, item);
    const product = attribution.status === "attributed" ? attribution.product : null;
    const decided = decideStripeBalanceTransaction(facts, attribution);
    if (!decided.ok) {
      // Stripe reported something the policy cannot book (an id it does not recognise, say).
      return { outcome: "parked", product, reason: "bad_amounts" };
    }
    const decision = decided.value;
    switch (decision.action) {
      case "nothing":
        return { outcome: "nothing", product };
      case "park":
        return { outcome: "parked", product, reason: decision.reason };
      case "book":
        if (!aimed(decision.product)) return { outcome: "not_aimed", product: decision.product };
        return {
          outcome: "booked",
          product: decision.product,
          documents: decision.projection.documents,
          feePence: decision.feePence,
          payoutPence: decision.payoutPence,
        };
    }
  }
}
