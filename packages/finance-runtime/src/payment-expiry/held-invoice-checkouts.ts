import type { PaymentEligibility } from "@auction/domain";
import type { OpenGroupCheckout } from "@auction/persistence/interfaces";
import type { IPaymentProviderCloser } from "./provider-money-state.js";
import type { IStalePaymentStore } from "./stale-payment-expiry.js";

/** The account rule both ways of paying use (closed, held or payable). */
export interface IHeldEligibility {
  check(input: { payerUserId: string; buyerLegalEntityId: string }): Promise<PaymentEligibility>;
}

/** Closes what a held invoice still has open in Stripe. */
export interface IHeldInvoiceCheckouts {
  close(paymentId: string): Promise<void>;
  sweep(limit?: number): Promise<HeldSweepReport>;
}

export type HeldSweepReport = {
  /** Single invoices looked at, and whose checkouts were closed. */
  checked: number;
  closed: number;
  /** "Pay several" payments looked at, and whose checkout was closed for a held member. */
  groupsChecked: number;
  groupsClosed: number;
};

export type HeldInvoiceCheckoutsDeps = {
  payments: Pick<IStalePaymentStore, "findForExpiry" | "checkoutSessionIds">;
  provider: IPaymentProviderCloser;
  eligibility: IHeldEligibility;
  listUnpaidWithCheckout: (
    limit: number,
  ) => Promise<{ id: string; payerUserId: string; buyerLegalEntityId: string }[]>;
  /** Open "Pay several" payments with a checkout, with their payer and unpaid members. */
  listOpenGroupsWithCheckout: (limit: number) => Promise<OpenGroupCheckout[]>;
};

/**
 * A held invoice (its account cannot pay yet) must not stay payable through a checkout opened
 * before the hold: its open Checkout sessions are closed and unfunded intents cancelled. A bank
 * transfer that has already received money is left alone; money that still arrives for a held
 * invoice goes to manual review, never straight to capture.
 */
export class HeldInvoiceCheckouts implements IHeldInvoiceCheckouts {
  constructor(private readonly deps: HeldInvoiceCheckoutsDeps) {}

  /** Closes what Stripe holds open for one invoice. */
  async close(paymentId: string): Promise<void> {
    const current = await this.deps.payments.findForExpiry(paymentId);
    if (!current) return;
    await this.deps.provider.closeAndRead({
      paymentId,
      paymentIntentId: current.stripePaymentIntentId,
      checkoutSessionIds: await this.deps.payments.checkoutSessionIds(paymentId),
    });
  }

  /**
   * Closes the checkouts of every held invoice that still has one, and the checkout of every open
   * "Pay several" payment with a held member (or a held or unknown payer). Safe to run at any
   * time and as often as needed (closing a closed session does nothing); run at deploy and with
   * expiry. A group's checkout that closes is released by its expiry event, which hands its
   * invoices back to being due on their own.
   */
  async sweep(limit = 500): Promise<HeldSweepReport> {
    const candidates = await this.deps.listUnpaidWithCheckout(limit);
    let closed = 0;
    for (const invoice of candidates) {
      if (!(await this.isHeld(invoice.payerUserId, invoice.buyerLegalEntityId))) continue;
      await this.close(invoice.id);
      closed += 1;
    }
    const groups = await this.deps.listOpenGroupsWithCheckout(limit);
    let groupsClosed = 0;
    for (const group of groups) {
      if (!(await this.groupHasHold(group))) continue;
      await this.closeGroup(group);
      groupsClosed += 1;
    }
    return { checked: candidates.length, closed, groupsChecked: groups.length, groupsClosed };
  }

  private async isHeld(payerUserId: string, buyerLegalEntityId: string): Promise<boolean> {
    const eligibility = await this.deps.eligibility.check({ payerUserId, buyerLegalEntityId });
    return eligibility.kind === "held";
  }

  /**
   * Whether the group's checkout must close: its payer or any member invoice is held. A group
   * with no recorded payer can never settle (settlement refuses it), so it is closed too.
   */
  private async groupHasHold(group: OpenGroupCheckout): Promise<boolean> {
    if (!group.payerUserId) return true;
    if (await this.isHeld(group.payerUserId, group.buyerLegalEntityId)) return true;
    for (const member of group.members) {
      if (await this.isHeld(member.payerUserId, member.buyerLegalEntityId)) return true;
    }
    return false;
  }

  /** Closes the group's one checkout, and its intent while nothing was paid into it. */
  private async closeGroup(group: OpenGroupCheckout): Promise<void> {
    await this.deps.provider.closeAndRead({
      paymentId: group.id,
      paymentIntentId: group.stripePaymentIntentId,
      checkoutSessionIds: group.stripeCheckoutSessionId ? [group.stripeCheckoutSessionId] : [],
    });
  }
}
