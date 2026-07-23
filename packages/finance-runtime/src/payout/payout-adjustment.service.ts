import type { Database } from "@auction/db";
import type { IPayoutRepository, ITransactionRunner } from "@auction/persistence/interfaces";
import type { PayoutLineKind } from "@auction/types";
import { subtractDecimal, sumDecimal } from "../decimal-money.js";
import type { IPayoutAdjustmentPort } from "../payout-adjustment-port.js";
import { payoutRepoForTx as defaultPayoutRepoForTx } from "./payout-helpers.js";

const DEFAULT_CURRENCY = "GBP";

const AGGREGATED_LINE_KINDS: PayoutLineKind[] = ["refund", "dispute"];

export type PayoutRepoForTx = (rootRepo: IPayoutRepository, tx: Database) => IPayoutRepository;

export type AddPaymentPayoutLineInput = {
  legalEntityId: string;
  paymentId: string;
  amount: string;
  kind: PayoutLineKind;
  sourceEventId?: string | null;
  note: string | null;
  tx?: Database;
};

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
            const aggregatedAmount = sumDecimal([existing.amount, input.amount]);
            await r.updateLineAmount(existing.id, aggregatedAmount, input.sourceEventId ?? null);
            await this.recalculateTotalsFromLines(r, openPayout.id);
            return;
          }
        }
        await r.insertLine({
          payoutId: openPayout.id,
          paymentId: input.paymentId,
          amount: input.amount,
          kind: input.kind,
          createdByUserId: null,
          note: input.note,
          sourceEventId: input.sourceEventId ?? null,
        });
        await this.recalculateTotalsFromLines(r, openPayout.id);
        return;
      }

      const now = new Date();
      const created = await r.create({
        legalEntityId: input.legalEntityId,
        periodStart: new Date(now.getTime() - 1),
        periodEnd: now,
        grossAmount: input.amount,
        platformFee: "0.00",
        stripeFee: "0.00",
        netAmount: input.amount,
        currency: DEFAULT_CURRENCY,
      });
      await r.insertLine({
        payoutId: created.id,
        paymentId: input.paymentId,
        amount: input.amount,
        kind: input.kind as PayoutLineKind,
        createdByUserId: null,
        note: input.note,
        sourceEventId: input.sourceEventId ?? null,
      });
    };

    if (input.tx) {
      await run(input.tx);
      return;
    }
    await this.transactionRunner.runInTransaction(run);
  }

  async recalculateTotalsFromLines(repo: IPayoutRepository, payoutId: string): Promise<void> {
    const payout = await repo.findById(payoutId);
    if (!payout) return;
    const lines = await repo.listLines(payoutId);
    const grossAmount = sumDecimal(lines.map((l) => l.amount));
    const netAmount = subtractDecimal(
      subtractDecimal(grossAmount, payout.platformFee),
      payout.stripeFee,
    );
    await repo.updateTotals(payoutId, {
      grossAmount,
      platformFee: payout.platformFee,
      netAmount,
    });
  }
}
