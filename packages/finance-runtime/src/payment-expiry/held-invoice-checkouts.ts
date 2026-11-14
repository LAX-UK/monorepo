import type { PaymentEligibility } from "@auction/domain";
import type { OpenGroupCheckout } from "@auction/persistence/interfaces";
import type { IPaymentProviderCloser, ProviderMoneyState } from "./provider-money-state.js";
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
  /** Single invoices looked at (held or not). */
  checked: number;
  /**
   * Held single invoices whose open checkout this pass closed, and the provider then confirmed
   * nothing is open and no money was paid or is on its way (`no_money`). Not "every held
   * invoice": one with money (`paid`, `inFlight`), one already closed on an earlier pass
   * (`alreadyClosed`) or one the provider could not confirm (`notClosed`) is counted there.
   */
  closed: number;
  /** "Pay several" payments looked at, and those closed this pass (the same rule as `closed`). */
  groupsChecked: number;
  groupsClosed: number;
  /**
   * Held invoices and groups with nothing left open to close (closed on an earlier pass or by
   * Stripe) and no money: counted here, not as closed again on every pass.
   */
  alreadyClosed: number;
  /** Held invoices and groups whose money arrived: nothing was closed; capture or review handles it. */
  paid: number;
  /**
   * Held invoices and groups with money on its way (a processing payment, or a bank transfer
   * received in part): the intent is deliberately left open so it can take the rest.
   */
  inFlight: number;
  /** Held invoices and groups whose checkout could not be confirmed closed; tried again next run. */
  notClosed: number;
  /** Invoices and groups whose check or close threw: reported and skipped, the sweep goes on. */
  failed: number;
};

/** Where a sweep reports one invoice or group it could not handle (the rest still run). */
export type HeldSweepFailure = { kind: "invoice" | "group"; id: string; error: unknown };

export type HeldInvoiceCheckoutsDeps = {
  payments: Pick<IStalePaymentStore, "findForExpiry" | "checkoutSessionIds">;
  provider: IPaymentProviderCloser;
  eligibility: IHeldEligibility;
  listUnpaidWithCheckout: (
    limit: number,
  ) => Promise<{ id: string; payerUserId: string; buyerLegalEntityId: string }[]>;
  /** Open "Pay several" payments with a checkout, with their payer and unpaid members. */
  listOpenGroupsWithCheckout: (limit: number) => Promise<OpenGroupCheckout[]>;
  /** Reports a candidate the sweep had to skip. Defaults to a structured log line. */
  onFailure?: (failure: HeldSweepFailure) => void;
};

type Outcome = "closed" | "alreadyClosed" | "paid" | "inFlight" | "notClosed";

/**
 * What one close did. Only `no_money` from a close that shut something itself counts as closed:
 * `paid` and `in_flight` leave money (and possibly the intent) in place, and `unknown` is not
 * confirmed.
 */
function outcomeOf(state: ProviderMoneyState | null): Outcome {
  if (!state) return "notClosed";
  switch (state.kind) {
    case "no_money":
      return state.alreadyClosed ? "alreadyClosed" : "closed";
    case "paid":
      return "paid";
    case "in_flight":
      return "inFlight";
    default:
      return "notClosed";
  }
}

function logFailure(failure: HeldSweepFailure): void {
  console.error(
    JSON.stringify({
      msg: "held_checkout_sweep_failed",
      kind: failure.kind,
      id: failure.id,
      error: failure.error instanceof Error ? failure.error.message : String(failure.error),
    }),
  );
}

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
    await this.closeInvoice(paymentId);
  }

  /**
   * Closes the checkouts of every held invoice that still has one, and the checkout of every open
   * "Pay several" payment with a held member (or a held or unknown payer). Safe to run at any
   * time and as often as needed (closing a closed session does nothing); run at deploy and with
   * expiry. A group's checkout that closes is released by its expiry event, which hands its
   * invoices back to being due on their own. Each invoice and group is handled on its own: one
   * that fails is reported and skipped, and the rest of the sweep still runs.
   */
  async sweep(limit = 500): Promise<HeldSweepReport> {
    const report: HeldSweepReport = {
      checked: 0,
      closed: 0,
      groupsChecked: 0,
      groupsClosed: 0,
      alreadyClosed: 0,
      paid: 0,
      inFlight: 0,
      notClosed: 0,
      failed: 0,
    };
    const onFailure = this.deps.onFailure ?? logFailure;
    const candidates = await this.deps.listUnpaidWithCheckout(limit);
    report.checked = candidates.length;
    for (const invoice of candidates) {
      try {
        if (!(await this.isHeld(invoice.payerUserId, invoice.buyerLegalEntityId))) continue;
        report[outcomeOf(await this.closeInvoice(invoice.id))] += 1;
      } catch (error) {
        report.failed += 1;
        onFailure({ kind: "invoice", id: invoice.id, error });
      }
    }
    const groups = await this.deps.listOpenGroupsWithCheckout(limit);
    report.groupsChecked = groups.length;
    for (const group of groups) {
      try {
        if (!(await this.groupHasHold(group))) continue;
        const outcome = outcomeOf(await this.closeGroup(group));
        report[outcome === "closed" ? "groupsClosed" : outcome] += 1;
      } catch (error) {
        report.failed += 1;
        onFailure({ kind: "group", id: group.id, error });
      }
    }
    return report;
  }

  private async closeInvoice(paymentId: string): Promise<ProviderMoneyState | null> {
    const current = await this.deps.payments.findForExpiry(paymentId);
    if (!current) return null;
    return this.deps.provider.closeAndRead({
      paymentId,
      paymentIntentId: current.stripePaymentIntentId,
      checkoutSessionIds: await this.deps.payments.checkoutSessionIds(paymentId),
    });
  }

  private async isHeld(payerUserId: string, buyerLegalEntityId: string): Promise<boolean> {
    const eligibility = await this.deps.eligibility.check({ payerUserId, buyerLegalEntityId });
    return eligibility.kind === "held";
  }

  /**
   * Whether the group's checkout must close: its payer or any unpaid member invoice is held. A
   * group with no recorded payer can never settle (settlement refuses it), so it is closed too.
   * Deliberately stricter than settlement, which checks only the group's payer: a member whose
   * own invoice is held must not be paid through a group either. The stricter side only ever
   * closes a checkout (the buyer can open a new one once the hold is lifted), never takes money.
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
  private async closeGroup(group: OpenGroupCheckout): Promise<ProviderMoneyState> {
    return this.deps.provider.closeAndRead({
      paymentId: group.id,
      paymentIntentId: group.stripePaymentIntentId,
      checkoutSessionIds: group.stripeCheckoutSessionId ? [group.stripeCheckoutSessionId] : [],
    });
  }
}
