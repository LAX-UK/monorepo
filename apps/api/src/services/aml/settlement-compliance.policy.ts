import type { IAmlHoldStore } from "./ports.js";

export type SettlementComplianceReason = "aml_hold" | "source_of_funds_required";

export type SettlementComplianceDecision = {
  /** When true, settlement must be gated through manual compliance review. */
  hold: boolean;
  reason: SettlementComplianceReason | null;
};

export type SettlementComplianceInput = {
  buyerUserId: string;
  /** Settlement value in pence (platform is GBP-only). */
  amountPence: number;
  /**
   * When re-evaluating an existing payment (manual review release, checkout retry),
   * exclude it from linked-transaction aggregation so exposure is not double-counted.
   */
  excludePaymentId?: string;
};

export interface ISettlementCompliancePolicy {
  evaluate(input: SettlementComplianceInput): Promise<SettlementComplianceDecision>;
  /**
   * Read-only, amount-independent compliance snapshot for a buyer. Unlike
   * `evaluate`, this MUST NOT mutate state (no SoF case creation, no events) and
   * does not require a transaction amount — it is safe to call from GET
   * endpoints to surface blockers before any payment row exists.
   */
  peek(buyerUserId: string): Promise<SettlementComplianceDecision>;
}

/**
 * Source-of-Funds gate (implemented by the SoF service). Returns true when SoF
 * evidence must be collected/approved before settlement for this buyer+amount.
 */
export interface ISourceOfFundsGate {
  requiresSourceOfFunds(input: SettlementComplianceInput): Promise<boolean>;
  /**
   * Read-only check: does the buyer have an unresolved (pending) SoF case that
   * is currently gating settlement? No side effects (does not open a case).
   */
  hasPendingCaseForUser(buyerUserId: string): Promise<boolean>;
}

/**
 * Pre-settlement compliance gate (CDD Sections 5 & 6). Halts settlement when:
 *  - the buyer is on an AML/sanctions hold (screening review or confirmed block), or
 *  - the transaction crosses the Source-of-Funds threshold without approved SoF.
 *
 * Reused inside the existing `requires_manual_review` payment flow so settlement
 * is paused without inventing a parallel state machine (Open/Closed).
 */
export class AmlSettlementCompliancePolicy implements ISettlementCompliancePolicy {
  constructor(
    private readonly holdStore: IAmlHoldStore,
    private readonly sourceOfFundsGate: ISourceOfFundsGate | null = null,
  ) {}

  async evaluate(input: SettlementComplianceInput): Promise<SettlementComplianceDecision> {
    const hold = await this.holdStore.getHold(input.buyerUserId);
    if (hold && hold.status !== "none") {
      return { hold: true, reason: "aml_hold" };
    }
    if (this.sourceOfFundsGate) {
      const requiresSof = await this.sourceOfFundsGate.requiresSourceOfFunds(input);
      if (requiresSof) {
        return { hold: true, reason: "source_of_funds_required" };
      }
    }
    return { hold: false, reason: null };
  }

  async peek(buyerUserId: string): Promise<SettlementComplianceDecision> {
    const hold = await this.holdStore.getHold(buyerUserId);
    if (hold && hold.status !== "none") {
      return { hold: true, reason: "aml_hold" };
    }
    if (this.sourceOfFundsGate) {
      const pending = await this.sourceOfFundsGate.hasPendingCaseForUser(buyerUserId);
      if (pending) {
        return { hold: true, reason: "source_of_funds_required" };
      }
    }
    return { hold: false, reason: null };
  }
}
