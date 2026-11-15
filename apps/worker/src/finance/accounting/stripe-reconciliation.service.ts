import {
  LEGAL_ENTITIES,
  type LegalEntity,
  PRODUCTS,
  booksTargetMode,
  legalEntityFor,
} from "@auction/accounting-domain";
import { addCalendarKeyDays } from "@auction/datetime";
import type {
  DayKindTotals,
  IAccountingSourceSettingReader,
  IStripeReconciliationStore,
  ParkedBalanceTransaction,
  PayoutKindTotals,
  StripeAccountState,
  UnbookedMovement,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { ACCOUNTING_ALERTS, type AccountingAlertSink } from "./accounting-alerts.js";
import type { StripeBalanceReader } from "./stripe-balance-reader.js";
import { londonDay, startOfLondonDay } from "./stripe-books-sync.service.js";

/** Where every report is kept: private document storage, under this prefix only. */
export const RECONCILIATION_PREFIX = "accounting/reconciliation";

/**
 * The balance transaction types the runbook documents as moving the Stripe balance outside the
 * clearing figure: Bid's seller transfers and their reversals or failures (`transfer_cancel`,
 * `transfer_refund`, `transfer_failure`), refunds (`refund`, and `payment_refund` for the bank
 * transfer payments the checkout takes through Stripe's customer balance), and dispute amounts
 * (Stripe books those as `adjustment`). Any other type that moved the balance is not known, so it stays in the clearing
 * difference and raises the alert.
 */
export const KNOWN_UNBOOKED_TYPES: ReadonlySet<string> = new Set([
  "transfer",
  "transfer_cancel",
  "transfer_refund",
  "transfer_failure",
  "refund",
  "payment_refund",
  "adjustment",
]);

/** The storage key of one company's report for one day, made at `at`. */
export function reconciliationKey(entity: LegalEntity, day: string, at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  return `${RECONCILIATION_PREFIX}/${entity}/${day}/${stamp}.json`;
}

export interface ReconciliationClearing {
  /** False when a Stripe account of the company has no opening balance stated: nothing compared. */
  readonly reconcilable: boolean;
  readonly openingPence: number;
  readonly since: string | null;
  readonly booksPaymentsPence: number;
  readonly booksExpensesPence: number;
  readonly booksTransfersPence: number;
  /** Payouts' bills paid from clearing (sellers' and artists' Stripe Connect transfers), issued. */
  readonly booksPayoutPaymentsPence: number;
  /** Opening, plus payments, less expenses, transfers and payout payments, as Books holds them. */
  readonly booksClearingPence: number;
  /** Stripe's balance (available and pending, GBP) for the company's accounts when read. */
  readonly stripeBalancePence: number | null;
  /** Registered for Books and not issued yet: in flight, so not counted as a difference. */
  readonly inFlightPence: number;
  /**
   * Movements in the Stripe balance since the opening that the clearing figure does not take from
   * Books (seller transfers, refunds, dispute amounts), by type: known, so not a difference.
   */
  readonly knownUnbooked: readonly UnbookedMovement[];
  /**
   * The known movements, less the Stripe transfers that are booked in Books (or on their way) as
   * payout payments: those left Stripe as a `transfer` and are in the Books figure already.
   */
  readonly knownUnbookedPence: number;
  /** Payout payments issued or on their way: the part of the `transfer` movements Books holds. */
  readonly transfersBookedAsPayoutPaymentsPence: number;
  /** Stripe less Books less what is in flight less what is known unbooked. Zero when they agree. */
  readonly unexplainedPence: number | null;
}

/**
 * A Stripe account the report could not rely on: no opening stated (never read), no balance read
 * (no key for it, or the read failed), not read through the day (the read failed or stopped), or
 * a key that reads an account no LAX row names.
 */
export interface AccountNotRead {
  readonly stripeAccountId: string;
  readonly reason: "no_opening" | "balance_not_read" | "not_read_through" | "not_registered";
}

/** One company's report for one day. Ids and amounts only: no names, no emails. */
export interface ReconciliationReport {
  readonly version: 1;
  readonly legalEntity: LegalEntity;
  readonly day: string;
  readonly generatedAt: string;
  readonly rehearsal: boolean;
  readonly target: { readonly provider: "books"; readonly mode: string };
  /** False when an account was not read (`accountsNotRead`): the figures miss its movements. */
  readonly complete: boolean;
  readonly accountsNotRead: readonly AccountNotRead[];
  /**
   * LAX totals against Books totals, by document type, for the day. Documents still on their way
   * (`notIssued...`) are shown, not counted as a difference: `differencePence` is LAX less Books
   * less what is on its way.
   */
  readonly byType: readonly (DayKindTotals & { readonly differencePence: number })[];
  /** Balance transactions of the day that wait for a person, and why. */
  readonly parked: readonly ParkedBalanceTransaction[];
  readonly clearing: ReconciliationClearing;
  /** Seller money held in the Stripe balance for transfers not made yet; null when not tracked. */
  readonly heldTransferPence: number | null;
  /**
   * The day's payouts (the payout ledger's net owed) against their bills and bill payments: issued,
   * on their way, and parked for the accountant or a person (shown, not a difference).
   * `differencePence` is LAX less Books less what is on its way less what is parked.
   */
  readonly payouts: readonly (PayoutKindTotals & { readonly differencePence: number })[];
  readonly mismatches: number;
}

export interface StripeReconciliationDeps {
  readonly store: IStripeReconciliationStore;
  readonly settings: IAccountingSourceSettingReader;
  readonly readers: readonly StripeBalanceReader[];
  readonly storage: {
    putObject(key: string, body: Buffer, contentType: string): Promise<unknown>;
  };
  readonly alerts: AccountingAlertSink;
  readonly now: () => Date;
  readonly log: Pick<Logger, "info" | "warn">;
}

/** The company's accounts the report cannot rely on for `day`, and why. */
function notReadThrough(
  accounts: readonly StripeAccountState[],
  balances: ReadonlyMap<string, number>,
  day: string,
): AccountNotRead[] {
  const dayEnd = startOfLondonDay(addCalendarKeyDays(day, 1));
  return accounts.flatMap((a): AccountNotRead[] => {
    const reason = !a.opening
      ? "no_opening"
      : !balances.has(a.stripeAccountId)
        ? "balance_not_read"
        : a.readThrough === null || a.readThrough < dayEnd
          ? "not_read_through"
          : null;
    return reason ? [{ stripeAccountId: a.stripeAccountId, reason }] : [];
  });
}

/** The previous London calendar day, `YYYY-MM-DD`. */
export function previousLondonDay(now: Date): string {
  return addCalendarKeyDays(londonDay(now), -1);
}

/**
 * The daily reconciliation report, one per company whose products are aimed at Books: LAX's
 * totals against Books' by day and document type (payments, Stripe fees, payouts), the Stripe
 * clearing account in Books against Stripe's balance, and seller money held for transfers. Stored
 * as JSON in private document storage (never in the repository) and recorded. Any mismatch (a type
 * whose totals differ, a transaction parked for a person, an account not read, clearing that does
 * not agree) raises the accounting alert `accounting_reconciliation_mismatch`, which Sentry routes
 * to finance on-call.
 */
export class StripeReconciliation {
  constructor(private readonly deps: StripeReconciliationDeps) {}

  async run(
    day: string = previousLondonDay(this.deps.now()),
  ): Promise<readonly ReconciliationReport[]> {
    const config = await this.deps.settings.read();
    if (!config.ok) throw new Error(`accounting_switch_unreadable:${config.refusal.code}`);
    const balances = await this.balancesByAccount();
    const accountsOf = new Map<LegalEntity, readonly StripeAccountState[]>();
    for (const entity of LEGAL_ENTITIES) {
      accountsOf.set(entity, await this.deps.store.openings(entity));
    }
    const registered = new Set([...accountsOf.values()].flat().map((a) => a.stripeAccountId));
    // A key for an account no LAX row names belongs to no company: every report shows it.
    const unregistered = [...balances.keys()]
      .filter((id) => !registered.has(id))
      .map((stripeAccountId) => ({ stripeAccountId, reason: "not_registered" as const }));
    const reports: ReconciliationReport[] = [];
    for (const entity of LEGAL_ENTITIES) {
      const mode = PRODUCTS.filter((p) => legalEntityFor(p) === entity)
        .map((p) => booksTargetMode(config.value[p]))
        .find((m) => m !== null);
      if (!mode) continue;
      const target = { provider: "books" as const, mode };
      const accounts = accountsOf.get(entity) ?? [];
      const notRead = [...notReadThrough(accounts, balances, day), ...unregistered];
      reports.push(await this.report(entity, day, target, balances, accounts, notRead));
    }
    return reports;
  }

  /** Each key's account and balance; a key that cannot be read is left out (and so reported). */
  private async balancesByAccount(): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    for (const reader of this.deps.readers) {
      try {
        out.set(await reader.accountId(), await reader.balancePence());
      } catch (error) {
        this.deps.log.warn({ err: error }, "accounting_reconciliation_balance_unread");
      }
    }
    return out;
  }

  private async report(
    entity: LegalEntity,
    day: string,
    target: { readonly provider: "books"; readonly mode: string },
    balances: ReadonlyMap<string, number>,
    accounts: readonly StripeAccountState[],
    accountsNotRead: readonly AccountNotRead[],
  ): Promise<ReconciliationReport> {
    const at = this.deps.now();
    const totals = await this.deps.store.dayTotals(entity, day, target);
    const byType = totals.map((t) => ({
      ...t,
      differencePence: t.laxPence - t.booksPence - t.notIssuedPence,
    }));
    const parked = await this.deps.store.parkedOn(entity, day);
    const clearing = await this.clearing(entity, target, balances, accounts);
    const heldTransferPence = await this.deps.store.heldTransferPence(entity);
    const payouts = (await this.deps.store.payoutTotals(entity, day, target)).map((t) => ({
      ...t,
      differencePence: t.laxPence - t.booksPence - t.notIssuedPence - t.parkedPence,
    }));
    const mismatches =
      byType.filter(
        (t) => t.differencePence !== 0 || t.laxCount !== t.booksCount + t.notIssuedCount,
      ).length +
      payouts.filter(
        (t) =>
          t.differencePence !== 0 ||
          t.unmatchedCount !== 0 ||
          t.laxCount !== t.booksCount + t.notIssuedCount + t.parkedCount,
      ).length +
      parked.length +
      accountsNotRead.length +
      (clearing.unexplainedPence !== null && clearing.unexplainedPence !== 0 ? 1 : 0);
    const report: ReconciliationReport = {
      version: 1,
      legalEntity: entity,
      day,
      generatedAt: at.toISOString(),
      rehearsal: target.mode !== "live",
      target,
      complete: accountsNotRead.length === 0,
      accountsNotRead,
      byType,
      parked,
      clearing,
      heldTransferPence,
      payouts,
      mismatches,
    };
    const storageKey = reconciliationKey(entity, day, at);
    await this.deps.storage.putObject(
      storageKey,
      Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8"),
      "application/json",
    );
    await this.deps.store.saveReport({ entity, day, storageKey, mismatches, generatedAt: at });
    const fields = { legalEntity: entity, day, mismatches, storageKey };
    if (mismatches > 0) this.deps.alerts.raise(ACCOUNTING_ALERTS.reconciliationMismatch, fields);
    this.deps.log.info(fields, "accounting_reconciliation_stored");
    return report;
  }

  private async clearing(
    entity: LegalEntity,
    target: { readonly provider: "books"; readonly mode: string },
    balances: ReadonlyMap<string, number>,
    accounts: readonly StripeAccountState[],
  ): Promise<ReconciliationClearing> {
    const opened = accounts.flatMap((a) => (a.opening ? [a.opening] : []));
    const reconcilable = accounts.length > 0 && opened.length === accounts.length;
    const since = reconcilable ? (opened.map((o) => o.on).sort()[0] ?? null) : null;
    const openingPence = opened.reduce((sum, o) => sum + o.balancePence, 0);
    const read = accounts.map((a) => balances.get(a.stripeAccountId));
    const stripeBalancePence = read.every((b) => b !== undefined)
      ? read.reduce<number>((sum, b) => sum + (b ?? 0), 0)
      : null;
    const moves = since
      ? // Stripe's balance is read now, so Books is read through today too.
        await this.deps.store.clearingSince(entity, since, londonDay(this.deps.now()), target)
      : {
          paymentsPence: 0,
          expensesPence: 0,
          transfersPence: 0,
          billPaymentsPence: 0,
          billPaymentsNotIssuedPence: 0,
          notIssuedPence: 0,
        };
    const knownUnbooked = since
      ? (await this.deps.store.knownUnbooked(entity)).filter((m) =>
          KNOWN_UNBOOKED_TYPES.has(m.type),
        )
      : [];
    // A payout paid by a Stripe Connect transfer left the balance as a `transfer` (known unbooked)
    // and is booked in Books as the payout's payment from clearing: counted once, in Books.
    const transfersBookedAsPayoutPaymentsPence =
      moves.billPaymentsPence + moves.billPaymentsNotIssuedPence;
    const knownUnbookedPence =
      knownUnbooked.reduce((sum, m) => sum + m.pence, 0) + transfersBookedAsPayoutPaymentsPence;
    const booksClearingPence =
      openingPence +
      moves.paymentsPence -
      moves.expensesPence -
      moves.transfersPence -
      moves.billPaymentsPence;
    const unexplainedPence =
      reconcilable && stripeBalancePence !== null
        ? stripeBalancePence - booksClearingPence - moves.notIssuedPence - knownUnbookedPence
        : null;
    return {
      reconcilable,
      openingPence,
      since,
      booksPaymentsPence: moves.paymentsPence,
      booksExpensesPence: moves.expensesPence,
      booksTransfersPence: moves.transfersPence,
      booksPayoutPaymentsPence: moves.billPaymentsPence,
      booksClearingPence,
      stripeBalancePence,
      inFlightPence: moves.notIssuedPence,
      knownUnbooked,
      knownUnbookedPence,
      transfersBookedAsPayoutPaymentsPence,
      unexplainedPence,
    };
  }
}
