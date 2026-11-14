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
  StripeAccountState,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { ACCOUNTING_ALERTS, type AccountingAlertSink } from "./accounting-alerts.js";
import type { StripeBalanceReader } from "./stripe-balance-reader.js";
import { londonDay, startOfLondonDay } from "./stripe-books-sync.service.js";

/** Where every report is kept: private document storage, under this prefix only. */
export const RECONCILIATION_PREFIX = "accounting/reconciliation";

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
  /** Opening, plus payments, less expenses and transfers, as Books holds them. */
  readonly booksClearingPence: number;
  /** Stripe's balance (available and pending, GBP) for the company's accounts when read. */
  readonly stripeBalancePence: number | null;
  /** Registered for Books and not issued yet: in flight, so not counted as a difference. */
  readonly inFlightPence: number;
  /** Stripe less Books less what is in flight. Zero when they agree. */
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
  /** LAX totals against Books totals, by document type, for the day. */
  readonly byType: readonly (DayKindTotals & { readonly differencePence: number })[];
  /** Balance transactions of the day that wait for a person, and why. */
  readonly parked: readonly ParkedBalanceTransaction[];
  readonly clearing: ReconciliationClearing;
  /** Seller money held in the Stripe balance for transfers not made yet; null when not tracked. */
  readonly heldTransferPence: number | null;
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
    const byType = totals.map((t) => ({ ...t, differencePence: t.laxPence - t.booksPence }));
    const parked = await this.deps.store.parkedOn(entity, day);
    const clearing = await this.clearing(entity, target, balances, accounts);
    const heldTransferPence = await this.deps.store.heldTransferPence(entity);
    const mismatches =
      byType.filter((t) => t.differencePence !== 0 || t.laxCount !== t.booksCount).length +
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
      : { paymentsPence: 0, expensesPence: 0, transfersPence: 0, notIssuedPence: 0 };
    const booksClearingPence =
      openingPence + moves.paymentsPence - moves.expensesPence - moves.transfersPence;
    const unexplainedPence =
      reconcilable && stripeBalancePence !== null
        ? stripeBalancePence - booksClearingPence - moves.notIssuedPence
        : null;
    return {
      reconcilable,
      openingPence,
      since,
      booksPaymentsPence: moves.paymentsPence,
      booksExpensesPence: moves.expensesPence,
      booksTransfersPence: moves.transfersPence,
      booksClearingPence,
      stripeBalancePence,
      inFlightPence: moves.notIssuedPence,
      unexplainedPence,
    };
  }
}
