import {
  type ISellerTermsPolicy,
  SELLER_RULE_VERSION,
  type SellerTermsSnapshot,
  type SettlementSale,
  parseMoneyToMinorUnits,
} from "@auction/domain";
import type {
  ISaleSellerTermsStore,
  PendingPaymentRow,
  StoredSellerTerms,
} from "@auction/persistence/interfaces";
import { hammerAndPremiumOf } from "../seller-terms-at-raise.js";

/** Where a pending sale stands for a payout run, worked out from its seller terms. */
export interface ISettlementSellerTerms {
  /**
   * The sale as the run pays it, storing what it priced: a snapshot for a payment raised before
   * snapshots, or the new pricing of a held sale whose facts are now in place.
   */
  forRun(pending: PendingPaymentRow, sellerLegalEntityId: string): Promise<SettlementSale>;
  /** The same answer with nothing stored, for a preview of the next run. */
  forPreview(pending: PendingPaymentRow, sellerLegalEntityId: string): Promise<SettlementSale>;
}

/** What a sale needs done to its stored terms before the run can say where it stands. */
type Plan =
  | { kind: "stored"; terms: StoredSellerTerms }
  | { kind: "record"; snapshot: SellerTermsSnapshot; legacyPlatformFeePence: number }
  | { kind: "reprice"; id: string; snapshot: SellerTermsSnapshot }
  | { kind: "unpriceable"; reason: "legacy_invoice" };

const PREVIEW_ID = "preview";

/**
 * Settlement pays each sale from its seller-terms snapshot, and never from the old platform fee.
 * A payment raised before snapshots is priced now from its invoice's stored hammer and premium and
 * the signed agreement (the old fee is kept beside it for audit). A held sale is priced again, so
 * recording the missing agreement releases it into the next run; while a fact is still missing it
 * stays held with its reason and the seller's other sales are paid.
 */
export class SettlementSellerTerms implements ISettlementSellerTerms {
  constructor(
    private readonly policy: ISellerTermsPolicy,
    private readonly store: ISaleSellerTermsStore,
  ) {}

  async forRun(pending: PendingPaymentRow, sellerLegalEntityId: string): Promise<SettlementSale> {
    const plan = await this.plan(pending, sellerLegalEntityId);
    switch (plan.kind) {
      case "stored":
        return saleOf(pending, plan.terms);
      case "record":
        return saleOf(
          pending,
          await this.store.recordAtPayout({
            paymentId: pending.id,
            snapshot: plan.snapshot,
            legacyPlatformFeePence: plan.legacyPlatformFeePence,
          }),
        );
      case "reprice":
        return saleOf(pending, await this.store.repriceHeld(plan.id, plan.snapshot));
      case "unpriceable":
        return { kind: "held", paymentId: pending.id, lotId: pending.lotId, reason: plan.reason };
    }
  }

  async forPreview(
    pending: PendingPaymentRow,
    sellerLegalEntityId: string,
  ): Promise<SettlementSale> {
    const plan = await this.plan(pending, sellerLegalEntityId);
    switch (plan.kind) {
      case "stored":
        return saleOf(pending, plan.terms);
      case "record":
      case "reprice":
        return saleOf(pending, { id: PREVIEW_ID, snapshot: plan.snapshot });
      case "unpriceable":
        return { kind: "held", paymentId: pending.id, lotId: pending.lotId, reason: plan.reason };
    }
  }

  private async plan(pending: PendingPaymentRow, sellerLegalEntityId: string): Promise<Plan> {
    const stored = pending.sellerTerms;
    if (stored) {
      const { snapshot } = stored;
      // A priced sale is paid as it was priced; an invoice with no hammer line never gains one.
      if (snapshot.basis !== "held" || snapshot.heldReason === "legacy_invoice") {
        return { kind: "stored", terms: stored };
      }
      const priced = await this.policy.snapshotFor({
        lotId: snapshot.lotId,
        sellerLegalEntityId: snapshot.sellerLegalEntityId,
        hammerPence: snapshot.hammerPence,
        premiumPence: snapshot.premiumPence,
      });
      const unchanged = priced.basis === "held" && priced.heldReason === snapshot.heldReason;
      return unchanged
        ? { kind: "stored", terms: stored }
        : { kind: "reprice", id: stored.id, snapshot: priced };
    }

    // Raised before snapshots: priced now from the invoice it was raised on.
    if (!pending.lotId) return { kind: "unpriceable", reason: "legacy_invoice" };
    const legacyPlatformFeePence = Number(parseMoneyToMinorUnits(pending.platformFee));
    const split = hammerAndPremiumOf((await this.store.invoiceLinesForPayment(pending.id)) ?? []);
    const snapshot: SellerTermsSnapshot = split
      ? await this.policy.snapshotFor({
          lotId: pending.lotId,
          sellerLegalEntityId,
          hammerPence: split.hammerPence,
          premiumPence: split.premiumPence,
        })
      : {
          lotId: pending.lotId,
          sellerLegalEntityId,
          hammerPence: 0,
          premiumPence: 0,
          ruleVersion: SELLER_RULE_VERSION,
          basis: "held",
          heldReason: "legacy_invoice",
        };
    return { kind: "record", snapshot, legacyPlatformFeePence };
  }
}

function saleOf(pending: PendingPaymentRow, stored: StoredSellerTerms): SettlementSale {
  const { snapshot } = stored;
  switch (snapshot.basis) {
    case "agreement":
      return { kind: "ready", paymentId: pending.id, sellerTermsId: stored.id, terms: snapshot };
    case "lax_owned":
      return { kind: "lax_owned", paymentId: pending.id };
    case "held":
      return {
        kind: "held",
        paymentId: pending.id,
        lotId: snapshot.lotId,
        reason: snapshot.heldReason,
      };
  }
}
