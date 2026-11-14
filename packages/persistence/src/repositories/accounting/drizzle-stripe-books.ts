import {
  type LegalEntity,
  PRODUCTS,
  type Product,
  legalEntityFor,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import {
  accountingDocument,
  accountingReconciliationReport,
  accountingStripeAccount,
  accountingStripeBalanceTxn,
  accountingStripeCursor,
} from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  ClearingMovements,
  DayKindTotals,
  IStripeBooksLedger,
  IStripeReconciliationStore,
  ParkedBalanceTransaction,
  StripeAccountState,
  StripeBalanceOutcome,
  StripeBalanceRow,
  StripeChargeRefs,
  StripeRecordResult,
  UnbookedMovement,
} from "../../interfaces/accounting-stripe.js";
import type { AccountingClock } from "../../interfaces/accounting.js";
import { isPgCheckViolation } from "../../lib/pg-unique-violation.js";
import { DrizzleAccountingDocumentRegistry } from "./drizzle-accounting-document.registry.js";

/** A document the registry refused while a balance transaction was recorded; nothing was kept. */
export class StripeLedgerRefusedError extends Error {
  readonly retryable = false;
  constructor(
    readonly code: string,
    readonly reference: string,
  ) {
    super(`accounting_stripe_ledger_refused:${code}:${reference}`);
    this.name = "StripeLedgerRefusedError";
  }
}

/** The documents' reference is held by a cancelled document: booking again would send nothing. */
class CancelledReplay extends Error {}

function productsOf(entity: LegalEntity): Product[] {
  return PRODUCTS.filter((p) => legalEntityFor(p) === entity);
}

function toAccountState(row: {
  stripeAccountId: string;
  product: Product;
  readThrough: Date | null;
  openingBalancePence: number | null;
  openingOn: string | null;
}): StripeAccountState {
  return {
    stripeAccountId: row.stripeAccountId,
    product: row.product,
    readThrough: row.readThrough,
    opening:
      row.openingBalancePence !== null && row.openingOn !== null
        ? { balancePence: row.openingBalancePence, on: row.openingOn }
        : null,
  };
}

const ACCOUNT_COLUMNS = {
  stripeAccountId: accountingStripeAccount.stripeAccountId,
  product: accountingStripeAccount.product,
  readThrough: accountingStripeCursor.readThrough,
  openingBalancePence: accountingStripeAccount.openingBalancePence,
  openingOn: accountingStripeAccount.openingOn,
};

/**
 * The daily Stripe job's store (migration 0385). See `IStripeBooksLedger`: the balance
 * transaction's row and its documents are written in one transaction, and the row's primary key
 * decides which run books it.
 */
export class DrizzleStripeBooksLedger implements IStripeBooksLedger {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async accounts(): Promise<readonly StripeAccountState[]> {
    const rows = await this.db
      .select(ACCOUNT_COLUMNS)
      .from(accountingStripeAccount)
      .leftJoin(
        accountingStripeCursor,
        eq(accountingStripeCursor.stripeAccountId, accountingStripeAccount.stripeAccountId),
      )
      .orderBy(accountingStripeAccount.stripeAccountId);
    return rows.map(toAccountState);
  }

  async productsForCharge(refs: StripeChargeRefs): Promise<readonly Product[]> {
    const pi = refs.paymentIntentId;
    const ch = refs.chargeId;
    if (pi === null && ch === null) return [];
    // Bid: a payment or a payment group LAX stored with this charge or PaymentIntent. Shop: an
    // order holding the PaymentIntent, asked through the definer function (the worker cannot
    // read the column itself).
    const result = await this.db.execute<{ product: Product }>(sql`
      select 'bid' as product where exists (
        select 1 from payment p
         where (${pi}::text is not null and p.stripe_payment_intent_id = ${pi}::text)
            or (${ch}::text is not null and p.stripe_charge_id = ${ch}::text)
        union all
        select 1 from payment_group g
         where (${pi}::text is not null and g.stripe_payment_intent_id = ${pi}::text)
            or (${ch}::text is not null and g.stripe_charge_id = ${ch}::text)
      )
      union all
      select 'shop' as product
       where ${pi}::text is not null and accounting_stripe_shop_order(${pi}::text) is not null
    `);
    return result.rows.map((r) => r.product);
  }

  async record(row: StripeBalanceRow, outcome: StripeBalanceOutcome): Promise<StripeRecordResult> {
    try {
      return await this.recordOnce(row, outcome);
    } catch (error) {
      if (error instanceof CancelledReplay) {
        const parked = {
          outcome: "parked",
          product: outcome.product,
          reason: "was_cancelled",
        } as const;
        const result = await this.recordOnce(row, parked);
        return result === "recorded" ? "parked_instead" : result;
      }
      // A value the row's CHECKs or the registry refuse: parked for a person, in a transaction of
      // its own and with no documents, so one odd transaction never holds the account's cursor.
      if (!(error instanceof StripeLedgerRefusedError) && !isPgCheckViolation(error)) throw error;
      const parked = { outcome: "parked", product: null, reason: "unrecognised" } as const;
      const result = await this.recordOnce({ ...row, payoutId: null }, parked);
      return result === "recorded" ? "parked_instead" : result;
    }
  }

  private async recordOnce(
    row: StripeBalanceRow,
    outcome: StripeBalanceOutcome,
  ): Promise<StripeRecordResult> {
    const at = this.clock.now();
    return this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(accountingStripeBalanceTxn)
        .values({
          stripeAccountId: row.stripeAccountId,
          balanceTransactionId: row.id,
          type: row.type,
          currency: row.currency,
          amountPence: row.amountPence,
          feePence: row.feePence,
          createdAtStripe: row.createdAt,
          createdOn: row.createdOn,
          sourceId: row.sourceId,
          payoutId: row.payoutId,
          product: outcome.product,
          outcome: outcome.outcome,
          parkReason: outcome.outcome === "parked" ? outcome.reason : null,
          bookedFeePence: outcome.outcome === "booked" ? outcome.feePence : 0,
          bookedPayoutPence: outcome.outcome === "booked" ? outcome.payoutPence : 0,
          readAt: at,
        })
        .onConflictDoNothing()
        .returning({ id: accountingStripeBalanceTxn.balanceTransactionId });
      // Another run (earlier, or right now in another transaction) holds the row: it decided.
      if (!inserted) return "already_recorded";
      if (outcome.outcome !== "booked") return "recorded";
      const registry = new DrizzleAccountingDocumentRegistry(tx as unknown as Database, this.clock);
      const sourceEventRef = `stripe_balance_transaction:${row.stripeAccountId}:${row.id}`;
      for (const document of outcome.documents) {
        const registered = await registry.register({ document, sourceEventRef });
        if (!registered.ok) {
          throw new StripeLedgerRefusedError(registered.refusal.code, document.reference);
        }
        // A replay of a cancelled document (the migration was rolled back and applied again): it
        // is never sent, so the row must not say booked. Rolled back and parked for a person.
        if (!registered.value.created && registered.value.stored.record.status === "cancelled") {
          throw new CancelledReplay(document.reference);
        }
      }
      return "recorded";
    });
  }

  async advanceCursor(stripeAccountId: string, readThrough: Date): Promise<void> {
    const at = this.clock.now();
    await this.db
      .insert(accountingStripeCursor)
      .values({ stripeAccountId, readThrough, updatedAt: at })
      .onConflictDoUpdate({
        target: accountingStripeCursor.stripeAccountId,
        set: {
          readThrough: sql`greatest(${accountingStripeCursor.readThrough}, excluded.read_through)`,
          updatedAt: at,
        },
      });
  }
}

/** The day each kind is booked on, from the stored document. */
const DATE_FIELD = {
  payment: "receivedOn",
  expense: "spentOn",
  transfer: "transferredOn",
} as const;

/** Balance transaction types whose amount the payments flow books into clearing. */
const BOOKED_AS_PAYMENTS = ["charge", "payment"];

/** Reads behind the daily reconciliation report (see `IStripeReconciliationStore`). */
export class DrizzleStripeReconciliationStore implements IStripeReconciliationStore {
  constructor(private readonly db: Database) {}

  async dayTotals(
    entity: LegalEntity,
    day: string,
    target: { readonly provider: "books"; readonly mode: string },
  ): Promise<readonly DayKindTotals[]> {
    const d = accountingDocument;
    const docs = await this.db
      .select({
        kind: d.kind,
        registeredPence: sql<string>`coalesce(sum(${d.grossPence}) filter (where ${d.state} <> 'cancelled'), 0)`,
        registeredCount: sql<string>`count(*) filter (where ${d.state} <> 'cancelled')`,
        issuedPence: sql<string>`coalesce(sum(${d.grossPence}) filter (where ${d.state} = 'issued'), 0)`,
        issuedCount: sql<string>`count(*) filter (where ${d.state} = 'issued')`,
        notIssuedCount: sql<string>`count(*) filter (where ${d.state} not in ('issued', 'cancelled'))`,
      })
      .from(d)
      .where(
        and(
          eq(d.legalEntity, entity),
          eq(d.targetProvider, target.provider),
          sql`${d.targetMode} = ${target.mode}`,
          inArray(d.kind, ["payment", "expense", "transfer"]),
          sql`${d.payload} ->> (case ${d.kind}
                when 'payment' then ${DATE_FIELD.payment}
                when 'expense' then ${DATE_FIELD.expense}
                else ${DATE_FIELD.transfer} end) = ${day}`,
        ),
      )
      .groupBy(d.kind);
    const t = accountingStripeBalanceTxn;
    const [ledger] = await this.db
      .select({
        feePence: sql<string>`coalesce(sum(${t.bookedFeePence}), 0)`,
        feeCount: sql<string>`count(*) filter (where ${t.bookedFeePence} > 0)`,
        payoutPence: sql<string>`coalesce(sum(${t.bookedPayoutPence}), 0)`,
        payoutCount: sql<string>`count(*) filter (where ${t.bookedPayoutPence} > 0)`,
      })
      .from(t)
      .where(
        and(eq(t.outcome, "booked"), inArray(t.product, productsOf(entity)), eq(t.createdOn, day)),
      );
    const byKind = new Map(docs.map((r) => [r.kind, r]));
    const of = (kind: "payment" | "expense" | "transfer") => byKind.get(kind);
    const books = (kind: "payment" | "expense" | "transfer") => ({
      booksPence: Number(of(kind)?.issuedPence ?? 0),
      booksCount: Number(of(kind)?.issuedCount ?? 0),
      notIssuedCount: Number(of(kind)?.notIssuedCount ?? 0),
    });
    return [
      {
        kind: "payment",
        laxPence: Number(of("payment")?.registeredPence ?? 0),
        laxCount: Number(of("payment")?.registeredCount ?? 0),
        ...books("payment"),
      },
      {
        kind: "expense",
        laxPence: Number(ledger?.feePence ?? 0),
        laxCount: Number(ledger?.feeCount ?? 0),
        ...books("expense"),
      },
      {
        kind: "transfer",
        laxPence: Number(ledger?.payoutPence ?? 0),
        laxCount: Number(ledger?.payoutCount ?? 0),
        ...books("transfer"),
      },
    ];
  }

  async parkedOn(entity: LegalEntity, day: string): Promise<readonly ParkedBalanceTransaction[]> {
    const t = accountingStripeBalanceTxn;
    const a = accountingStripeAccount;
    // A parked row with no product (unattributable) belongs to the company whose account it is in.
    const rows = await this.db
      .select({
        stripeAccountId: t.stripeAccountId,
        balanceTransactionId: t.balanceTransactionId,
        type: t.type,
        reason: t.parkReason,
        amountPence: t.amountPence,
        feePence: t.feePence,
      })
      .from(t)
      .innerJoin(a, eq(a.stripeAccountId, t.stripeAccountId))
      .where(
        and(
          eq(t.outcome, "parked"),
          eq(t.createdOn, day),
          sql`coalesce(${t.product}, ${a.product}) in ${productsOf(entity)}`,
        ),
      )
      .orderBy(t.createdAtStripe, t.balanceTransactionId);
    return rows.map((r) => ({ ...r, reason: r.reason ?? "unknown" }));
  }

  async openings(entity: LegalEntity): Promise<readonly StripeAccountState[]> {
    const rows = await this.db
      .select(ACCOUNT_COLUMNS)
      .from(accountingStripeAccount)
      .leftJoin(
        accountingStripeCursor,
        eq(accountingStripeCursor.stripeAccountId, accountingStripeAccount.stripeAccountId),
      )
      .where(inArray(accountingStripeAccount.product, productsOf(entity)))
      .orderBy(accountingStripeAccount.stripeAccountId);
    return rows.map(toAccountState);
  }

  async clearingSince(
    entity: LegalEntity,
    since: string,
    through: string,
    target: { readonly provider: "books"; readonly mode: string },
  ): Promise<ClearingMovements> {
    const d = accountingDocument;
    const dateOf = sql`${d.payload} ->> (case ${d.kind}
      when 'payment' then ${DATE_FIELD.payment}
      when 'expense' then ${DATE_FIELD.expense}
      else ${DATE_FIELD.transfer} end)`;
    const signed = sql`case ${d.kind} when 'payment' then ${d.grossPence} else -${d.grossPence} end`;
    const [row] = await this.db
      .select({
        payments: sql<string>`coalesce(sum(${d.grossPence}) filter (where ${d.kind} = 'payment' and ${d.state} = 'issued'), 0)`,
        expenses: sql<string>`coalesce(sum(${d.grossPence}) filter (where ${d.kind} = 'expense' and ${d.state} = 'issued'), 0)`,
        transfers: sql<string>`coalesce(sum(${d.grossPence}) filter (where ${d.kind} = 'transfer' and ${d.state} = 'issued'), 0)`,
        notIssued: sql<string>`coalesce(sum(${signed}) filter (where ${d.state} not in ('issued', 'cancelled')), 0)`,
      })
      .from(d)
      .where(
        and(
          eq(d.legalEntity, entity),
          eq(d.targetProvider, target.provider),
          sql`${d.targetMode} = ${target.mode}`,
          inArray(d.kind, ["payment", "expense", "transfer"]),
          sql`${dateOf} >= ${since} and ${dateOf} <= ${through}`,
        ),
      );
    return {
      paymentsPence: Number(row?.payments ?? 0),
      expensesPence: Number(row?.expenses ?? 0),
      transfersPence: Number(row?.transfers ?? 0),
      notIssuedPence: Number(row?.notIssued ?? 0),
    };
  }

  async knownUnbooked(entity: LegalEntity): Promise<readonly UnbookedMovement[]> {
    const t = accountingStripeBalanceTxn;
    const a = accountingStripeAccount;
    // What the transaction moved (amount less fee), less what this job booked for it (a fee as an
    // expense, a payout as a transfer: both took money out), less a charge's amount (a payment).
    const pence = sql<string>`sum(${t.amountPence} - ${t.feePence} + ${t.bookedFeePence}
      + ${t.bookedPayoutPence} - case when ${inArray(t.type, BOOKED_AS_PAYMENTS)}
        then ${t.amountPence} else 0 end)`;
    const rows = await this.db
      .select({ type: t.type, pence })
      .from(t)
      .innerJoin(a, eq(a.stripeAccountId, t.stripeAccountId))
      .where(
        and(
          inArray(a.product, productsOf(entity)),
          inArray(t.outcome, ["booked", "nothing"]),
          sql`${t.createdOn} >= ${a.openingOn}`,
        ),
      )
      .groupBy(t.type)
      .having(sql`${pence} <> 0`)
      .orderBy(t.type);
    return rows.map((r) => ({ type: r.type, pence: Number(r.pence) }));
  }

  async heldTransferPence(entity: LegalEntity): Promise<number | null> {
    // Only Bid's seller payouts are LAX rows with a transfer still to make; Shop's are not yet.
    if (entity !== "london_auction_xchange") return null;
    const result = await this.db.execute<{ pence: string }>(sql`
      select coalesce(sum(round(net_amount * 100)), 0)::bigint as pence
        from payout where status in ('scheduled', 'transfer_blocked')
    `);
    return Number(result.rows[0]?.pence ?? 0);
  }

  async saveReport(input: {
    readonly entity: LegalEntity;
    readonly day: string;
    readonly storageKey: string;
    readonly mismatches: number;
    readonly generatedAt: Date;
  }): Promise<void> {
    await this.db
      .insert(accountingReconciliationReport)
      .values({
        legalEntity: input.entity,
        reportDay: input.day,
        storageKey: input.storageKey,
        mismatches: input.mismatches,
        generatedAt: input.generatedAt,
      })
      .onConflictDoUpdate({
        target: [
          accountingReconciliationReport.legalEntity,
          accountingReconciliationReport.reportDay,
        ],
        set: {
          storageKey: input.storageKey,
          mismatches: input.mismatches,
          generatedAt: input.generatedAt,
        },
      });
  }
}
