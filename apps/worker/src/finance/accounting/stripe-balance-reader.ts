/**
 * The source of a balance transaction, as far as LAX needs it: its id and the charge or
 * PaymentIntent behind it (a charge itself, or the charge a refund or dispute is for).
 */
export interface StripeBalanceSource {
  readonly id: string;
  readonly chargeId: string | null;
  readonly paymentIntentId: string | null;
}

/** One balance transaction, ids and amounts only (Stripe's own field names, in minor units). */
export interface StripeBalanceItem {
  readonly id: string;
  readonly type: string;
  readonly currency: string;
  readonly amount: number;
  readonly fee: number;
  /** Epoch seconds. */
  readonly created: number;
  readonly source: StripeBalanceSource | null;
}

export interface StripeBalancePage {
  readonly data: readonly StripeBalanceItem[];
  readonly hasMore: boolean;
}

/**
 * Read-only Stripe calls for the daily Stripe fees and payouts job: which account the key reads,
 * one page of balance transactions created in a window (newest first, as Stripe lists them), and
 * the balance. Nothing here writes to Stripe.
 */
export interface StripeBalanceReader {
  accountId(): Promise<string>;
  listBalanceTransactions(args: {
    /** Epoch seconds, inclusive. */
    readonly createdGte: number;
    /** Epoch seconds, exclusive. */
    readonly createdLt: number;
    readonly startingAfter?: string;
    readonly limit: number;
  }): Promise<StripeBalancePage>;
  /** The GBP balance, available and pending together, in pence. */
  balancePence(): Promise<number>;
}

type Expandable = string | { readonly id?: string } | null | undefined;

function idOf(value: Expandable): string | null {
  if (typeof value === "string") return value;
  return value && typeof value.id === "string" ? value.id : null;
}

/** The charge and PaymentIntent behind an expanded source, whatever kind of object it is. */
export function sourceOf(source: unknown): StripeBalanceSource | null {
  if (typeof source === "string") return { id: source, chargeId: null, paymentIntentId: null };
  if (typeof source !== "object" || source === null) return null;
  const s = source as Record<string, unknown>;
  if (typeof s.id !== "string") return null;
  const object = s.object;
  const chargeId = object === "charge" ? s.id : idOf(s.charge as Expandable);
  return { id: s.id, chargeId, paymentIntentId: idOf(s.payment_intent as Expandable) };
}

/** The read calls of the Stripe SDK this job uses, and no others. */
export interface StripeReadClient {
  readonly accounts: { retrieve(): Promise<{ id: string }> };
  readonly balanceTransactions: {
    list(params: {
      created: { gte: number; lt: number };
      limit: number;
      starting_after?: string;
      expand: string[];
    }): Promise<{
      has_more: boolean;
      data: readonly {
        id: string;
        type: string;
        currency: string;
        amount: number;
        fee: number;
        created: number;
        source: unknown;
      }[];
    }>;
  };
  readonly balance: {
    retrieve(): Promise<{
      available: readonly { amount: number; currency: string }[];
      pending: readonly { amount: number; currency: string }[];
    }>;
  };
}

/** The Stripe SDK behind `StripeBalanceReader`: list and retrieve calls only. */
export class StripeSdkBalanceReader implements StripeBalanceReader {
  private account: string | null = null;

  constructor(private readonly stripe: StripeReadClient) {}

  async accountId(): Promise<string> {
    if (this.account === null) this.account = (await this.stripe.accounts.retrieve()).id;
    return this.account;
  }

  async listBalanceTransactions(args: {
    readonly createdGte: number;
    readonly createdLt: number;
    readonly startingAfter?: string;
    readonly limit: number;
  }): Promise<StripeBalancePage> {
    const page = await this.stripe.balanceTransactions.list({
      created: { gte: args.createdGte, lt: args.createdLt },
      limit: args.limit,
      ...(args.startingAfter ? { starting_after: args.startingAfter } : {}),
      expand: ["data.source"],
    });
    return {
      hasMore: page.has_more,
      data: page.data.map((t) => ({
        id: t.id,
        type: t.type,
        currency: t.currency,
        amount: t.amount,
        fee: t.fee,
        created: t.created,
        source: sourceOf(t.source),
      })),
    };
  }

  async balancePence(): Promise<number> {
    const balance = await this.stripe.balance.retrieve();
    const gbp = (rows: readonly { amount: number; currency: string }[]) =>
      rows.filter((r) => r.currency === "gbp").reduce((sum, r) => sum + r.amount, 0);
    return gbp(balance.available) + gbp(balance.pending);
  }
}
