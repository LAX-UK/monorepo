import type { Database } from "@auction/db";
import {
  minorUnitsToMoneyString,
  parseMoneyToMinorUnits,
  payoutTotals,
  sellerRefundCharge,
} from "@auction/domain";
import type { IPayoutRepository, ITransactionRunner } from "@auction/persistence/interfaces";
import type { PayoutLineKind } from "@auction/types";
import { sumDecimal } from "../decimal-money.js";
import type { IPayoutAdjustmentPort } from "../payout-adjustment-port.js";
import { payoutRepoForTx as defaultPayoutRepoForTx } from "./payout-helpers.js";

const DEFAULT_CURRENCY = "GBP";

const AGGREGATED_LINE_KINDS: PayoutLineKind[] = ["refund", "dispute"];

export type PayoutRepoForTx = (rootRepo: IPayoutRepository, tx: Database) => IPayoutRepository;

export type AddPaymentPayoutLineInput = {
  legalEntityId: string;
  paymentId: string;
  /**
   * The line's amount (negative for money taken back). For a refund, the buyer's refund: what the
   * seller is charged for it is worked out here, from what they received for the sale.
   */
  amount: string;
  kind: PayoutLineKind;
  sourceEventId?: string | null;
  note: string | null;
  tx?: Database;
};

/** A line as it goes on the seller's ledger. */
type LedgerLine = { amount: string; buyerRefundPence: number | null };

/** The buyer refund a refund line answers for; a line from before that was recorded, its amount. */
function buyerRefundAnsweredBy(line: { amount: string; buyerRefundPence?: number | null }): number {
  return line.buyerRefundPence ?? Number(-parseMoneyToMinorUnits(line.amount));
}

export class PayoutAdjustmentService implements IPayoutAdjustmentPort {
  constructor(
    private readonly transactionRunner: ITransactionRunner,
    private readonly repo: IPayoutRepository,
    private readonly resolveRepoForTx: PayoutRepoForTx = defaultPayoutRepoForTx,
  ) {}

  async addPaymentLineToOpenPayoutOrCreateClawback(input: {
    legalEntityId: string;
    paymentId: string;
    amount: string;
    kind: "refund";
    sourceEventId: string;
    note: string;
    tx: unknown;
  }): Promise<void> {
    const payload: AddPaymentPayoutLineInput = {
      legalEntityId: input.legalEntityId,
      paymentId: input.paymentId,
      amount: input.amount,
      kind: input.kind,
      sourceEventId: input.sourceEventId,
      note: input.note,
    };
    if (input.tx != null) {
      payload.tx = input.tx as Database;
    }
    await this.addPaymentLineToOpenPayoutOrCreateClawbackFull(payload);
  }

  async addPaymentLineToOpenPayoutOrCreateClawbackFull(
    input: AddPaymentPayoutLineInput,
  ): Promise<void> {
    const run = async (tx: Database) => {
      const r = this.resolveRepoForTx(this.repo, tx);
      const ledger = await this.ledgerLine(r, input);
      if (!ledger) return;
      const openPayout = await r.findOpenPayoutForEntity(input.legalEntityId);

      if (openPayout) {
        if (input.sourceEventId && (await r.lineExistsForSourceEvent(input.sourceEventId))) {
          return;
        }
        if (AGGREGATED_LINE_KINDS.includes(input.kind)) {
          const existing = await r.findLineForPaymentAndKind(
            openPayout.id,
            input.paymentId,
            input.kind,
          );
          if (existing) {
            const aggregatedAmount = sumDecimal([existing.amount, ledger.amount]);
            await r.updateLineAmount(
              existing.id,
              aggregatedAmount,
              input.sourceEventId ?? null,
              ledger.buyerRefundPence === null
                ? undefined
                : buyerRefundAnsweredBy(existing) + ledger.buyerRefundPence,
            );
            await this.recalculateTotalsFromLines(r, openPayout.id);
            return;
          }
        }
        await r.insertLine({
          payoutId: openPayout.id,
          paymentId: input.paymentId,
          amount: ledger.amount,
          kind: input.kind,
          createdByUserId: null,
          note: input.note,
          sourceEventId: input.sourceEventId ?? null,
          buyerRefundPence: ledger.buyerRefundPence,
        });
        await this.recalculateTotalsFromLines(r, openPayout.id);
        return;
      }

      const now = new Date();
      const created = await r.create({
        legalEntityId: input.legalEntityId,
        periodStart: new Date(now.getTime() - 1),
        periodEnd: now,
        grossAmount: ledger.amount,
        platformFee: "0.00",
        stripeFee: "0.00",
        netAmount: ledger.amount,
        currency: DEFAULT_CURRENCY,
      });
      await r.insertLine({
        payoutId: created.id,
        paymentId: input.paymentId,
        amount: ledger.amount,
        kind: input.kind as PayoutLineKind,
        createdByUserId: null,
        note: input.note,
        sourceEventId: input.sourceEventId ?? null,
        buyerRefundPence: ledger.buyerRefundPence,
      });
    };

    if (input.tx) {
      await run(input.tx);
      return;
    }
    await this.transactionRunner.runInTransaction(run);
  }

  /**
   * What the line puts on the seller's ledger, or `null` when it puts nothing. A buyer's refund is
   * charged to the seller only as their share of what they received for the sale (nothing before
   * the sale is paid out); every other line goes on as given.
   */
  private async ledgerLine(
    r: IPayoutRepository,
    input: AddPaymentPayoutLineInput,
  ): Promise<LedgerLine | null> {
    if (input.kind !== "refund") return { amount: input.amount, buyerRefundPence: null };
    const buyerRefundPence = Number(-parseMoneyToMinorUnits(input.amount));
    const charge = sellerRefundCharge({
      facts: await r.findSellerClawbackFacts(input.paymentId),
      buyerRefundedBeforePence: await r.sumRefundLineCentsForPayment(input.paymentId),
      buyerRefundPence: Math.max(0, buyerRefundPence),
    });
    if (!charge) return null;
    return {
      amount: minorUnitsToMoneyString(BigInt(-charge.chargePence)),
      buyerRefundPence: charge.buyerRefundPence,
    };
  }

  async recalculateTotalsFromLines(repo: IPayoutRepository, payoutId: string): Promise<void> {
    const payout = await repo.findById(payoutId);
    if (!payout) return;
    const lines = await repo.listLines(payoutId);
    // The stored totals are what is transferred, so they are always the lines added up.
    const totals = payoutTotals(lines, payout.stripeFee);
    await repo.updateTotals(payoutId, {
      grossAmount: totals.gross,
      platformFee: totals.platformFee,
      netAmount: totals.net,
    });
  }
}
