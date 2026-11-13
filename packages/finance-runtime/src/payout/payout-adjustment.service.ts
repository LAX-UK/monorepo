import type { Database } from "@auction/db";
import {
  minorUnitsToMoneyString,
  parseMoneyToMinorUnits,
  payoutTakesLines,
  payoutTotals,
  sellerRefundCharge,
  sellerRefundGiveBack,
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

/** A buyer refund that failed, to be given back to the seller it was charged to. */
export type GiveBackFailedRefundInput = {
  legalEntityId: string;
  paymentId: string;
  /** The failed buyer refund being taken back, in pence (a positive figure). */
  buyerRefundPence: number;
  sourceEventId: string;
  note: string;
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
    await this.inTransaction(input.tx, async (r) => {
      const ledger = await this.ledgerLine(r, input);
      if (ledger) await this.postLine(r, input, ledger);
    });
  }

  /**
   * Gives the seller back what a buyer refund that failed had them charged. Charging is cumulative,
   * so the failed refund lowers the buyer refund the seller's lines answer for, and one refund line
   * gives back the difference between what was charged and the target for what still stands (see
   * `sellerRefundGiveBack`). The line keeps the buyer refund it reverses as a negative figure, so
   * every sum over the lines cancels the charge it reverses; it is written even when nothing comes
   * back. It goes on the open payout or a new one exactly as a charge does, under the same locks:
   * call it under the payment's lock, as every refund path holds it. Returns what was given back,
   * in pence: the line's amount, or 0 when nothing was written.
   */
  async giveBackFailedRefund(input: GiveBackFailedRefundInput): Promise<{ sellerPence: number }> {
    return this.inTransaction(input.tx, async (r) => {
      const giveBack = sellerRefundGiveBack({
        facts: await r.findSellerClawbackFacts(input.paymentId),
        reversedBuyerRefundPence: input.buyerRefundPence,
      });
      if (!giveBack) return { sellerPence: 0 };
      // The charge is zero or below: what comes back is its size.
      const sellerPence = Math.abs(giveBack.chargePence);
      const posted = await this.postLine(
        r,
        { ...input, kind: "refund" },
        {
          amount: minorUnitsToMoneyString(BigInt(sellerPence)),
          buyerRefundPence: giveBack.buyerRefundPence,
        },
      );
      return { sellerPence: posted ? sellerPence : 0 };
    });
  }

  private async inTransaction<T>(
    tx: Database | undefined,
    work: (r: IPayoutRepository) => Promise<T>,
  ): Promise<T> {
    if (tx) return work(this.resolveRepoForTx(this.repo, tx));
    return this.transactionRunner.runInTransaction((inner) =>
      work(this.resolveRepoForTx(this.repo, inner)),
    );
  }

  /**
   * Puts a line on the seller's open payout, added to the payment's line of the same kind there
   * (refunds and disputes), or on a new payout when none is open. Returns false when the event's
   * line is already on the open payout.
   */
  private async postLine(
    r: IPayoutRepository,
    input: Pick<
      AddPaymentPayoutLineInput,
      "legalEntityId" | "paymentId" | "kind" | "sourceEventId" | "note"
    >,
    ledger: LedgerLine,
  ): Promise<boolean> {
    // The payment before the payout: see `lockOpenPayout`.
    await r.lockPayment(input.paymentId);
    const openPayout = await this.lockOpenPayout(r, input.legalEntityId);

    if (openPayout) {
      if (input.sourceEventId && (await r.lineExistsForSourceEvent(input.sourceEventId))) {
        return false;
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
          return true;
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
      return true;
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
      kind: input.kind,
      createdByUserId: null,
      note: input.note,
      sourceEventId: input.sourceEventId ?? null,
      buyerRefundPence: ledger.buyerRefundPence,
    });
    return true;
  }

  /**
   * The seller's open payout, its row locked (`FOR UPDATE`) and seen still open under the lock
   * (`payoutTakesLines`), or `null` when none is open. The transfer step holds the same row lock
   * from reading the amount until the payout has left `scheduled`, so a line either lands before
   * the amount is read (and is sent with it) or finds the payout gone and goes on a new one.
   *
   * Lock order: settlement advisory lock, then payments (in id order when there are several), then
   * payout. `postLine` takes the line's payment just before this, so the order holds for every
   * caller: refund paths already hold it (re-entrant), and dispute paths, which lock the dispute
   * case and not the payment, take it here rather than waiting for it on the line's foreign key
   * while holding the payout.
   */
  private async lockOpenPayout(r: IPayoutRepository, legalEntityId: string) {
    // A payout that stopped taking lines while we waited for its lock is no longer open; look again,
    // since another scheduled payout may be the open one now.
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = await r.findOpenPayoutForEntity(legalEntityId);
      if (!candidate) return null;
      const locked = await r.findByIdForUpdate(candidate.id);
      if (locked && payoutTakesLines(locked)) return locked;
    }
    return null;
  }

  /**
   * What the line puts on the seller's ledger, or `null` when it puts nothing. A buyer's refund is
   * charged to the seller only as their share of what they received for the sale (nothing before
   * the sale is paid out); every other line goes on as given. A refund after payout whose share
   * comes to nothing still goes on, at £0.00 with the buyer refund it answered for, so the refund
   * is not taken as new (and announced again) by a later event for the same payment. A refund line
   * here takes money back: a failed refund is given back by `giveBackFailedRefund`, which knows what
   * the seller was charged for it.
   */
  private async ledgerLine(
    r: IPayoutRepository,
    input: AddPaymentPayoutLineInput,
  ): Promise<LedgerLine | null> {
    if (input.kind !== "refund") return { amount: input.amount, buyerRefundPence: null };
    const buyerRefundPence = Number(-parseMoneyToMinorUnits(input.amount));
    if (buyerRefundPence < 0) {
      throw new RangeError(
        "A refund line charges a buyer refund; a failed refund is given back by giveBackFailedRefund",
      );
    }
    const charge = sellerRefundCharge({
      facts: await r.findSellerClawbackFacts(input.paymentId),
      buyerRefundPence,
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
