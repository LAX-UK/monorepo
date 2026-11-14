import type {
  StripeBalanceItem,
  StripeBalancePage,
  StripeBalanceReader,
} from "../finance/accounting/stripe-balance-reader.js";

/**
 * Stripe's balance transactions in memory, listed the way Stripe lists them: newest first (ties by
 * id, descending), `created` in `[gte, lt)`, `starting_after` exclusive, at most `limit` per page
 * with `has_more`. No network. `calls` records every list call so a test can count pages and see
 * where a run resumed; `failAfterPages` makes the n-th next list call throw, as a dropped
 * connection would.
 */
export class FakeStripeBalance implements StripeBalanceReader {
  readonly calls: {
    createdGte: number;
    createdLt: number;
    startingAfter?: string;
    limit: number;
  }[] = [];
  private items: StripeBalanceItem[] = [];
  private failAt: number | null = null;

  constructor(
    private readonly account: string,
    private balance = 0,
  ) {}

  add(...items: StripeBalanceItem[]): this {
    this.items.push(...items);
    this.items.sort((a, b) => b.created - a.created || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    return this;
  }

  setBalance(pence: number): void {
    this.balance = pence;
  }

  /** The next list call after `pages` more successful ones throws once. */
  failAfterPages(pages: number): void {
    this.failAt = this.calls.length + pages;
  }

  async accountId(): Promise<string> {
    return this.account;
  }

  async listBalanceTransactions(args: {
    readonly createdGte: number;
    readonly createdLt: number;
    readonly startingAfter?: string;
    readonly limit: number;
  }): Promise<StripeBalancePage> {
    if (this.failAt !== null && this.calls.length === this.failAt) {
      this.failAt = null;
      throw new Error("fake_stripe_connection_reset");
    }
    this.calls.push({ ...args });
    const inWindow = this.items.filter(
      (t) => t.created >= args.createdGte && t.created < args.createdLt,
    );
    const from = args.startingAfter
      ? inWindow.findIndex((t) => t.id === args.startingAfter) + 1
      : 0;
    if (args.startingAfter && from === 0) throw new Error("fake_stripe_no_such_object");
    const data = inWindow.slice(from, from + args.limit);
    return { data, hasMore: from + args.limit < inWindow.length };
  }

  async balancePence(): Promise<number> {
    return this.balance;
  }
}

/** A balance transaction with Stripe-shaped defaults (a £100 card charge, £1.65 fee). */
export function stripeTxn(over: Partial<StripeBalanceItem> & { id: string }): StripeBalanceItem {
  return {
    type: "charge",
    currency: "gbp",
    amount: 10_000,
    fee: 165,
    created: Date.UTC(2026, 10, 13, 12) / 1000,
    source: null,
    ...over,
  };
}
