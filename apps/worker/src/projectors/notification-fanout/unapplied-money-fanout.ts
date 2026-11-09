import {
  type UnappliedMoneyPayload,
  type UnappliedMoneyReason,
  possibleSourceText,
} from "@auction/domain";
import type { IEmailService } from "@auction/email";
import { formatMoneyMajor } from "@auction/email";
import { FINANCE_ACCESS, adminRoutes, laxAdminRoutes } from "@auction/types";
import type { IStaffOpsRecipientReader } from "../../interfaces/staff-ops-recipient.reader.js";
import { centsToAmount, listStaffAlertTargets } from "./notification-fanout-helpers.js";

/** What finance is told happened, for each kind of money we could not apply. */
const SITUATION: Record<UnappliedMoneyReason, string> = {
  invoice_cancelled: "A payment arrived for an invoice that had been cancelled.",
  invoice_refunded: "A payment arrived for an invoice that had already been refunded.",
  invoice_already_paid: "A second payment arrived for an invoice that was already paid.",
  amount_mismatch: "A payment arrived for a different amount from the invoice total.",
  group_not_settleable:
    "A payment for several invoices arrived, but they could no longer all be settled by it.",
  group_overpaid:
    "A payment for several invoices received more than its total. The excess is for finance to return or apply.",
  customer_balance_unapplied:
    "Money is left in a buyer's Stripe balance with no open invoice to pay. The amount shown is the balance now, not necessarily what the latest transfer added.",
  paid_not_recorded: "Stripe shows an invoice paid, but the payment has not been recorded here.",
  private_sale_payment_not_applied:
    "Money arrived for a private sale deal that could not take it: its checkout had been ended, or the deal was already paid another way. Return it or apply it.",
  shop_order_paid_after_close:
    "A Shop buyer paid after their order had closed and its prints were released. Nothing was refunded. Open the order in LAX Admin, then refund the buyer or reinstate the order.",
  shop_order_amount_mismatch:
    "A Shop buyer paid an amount that is not their order's total. Nothing was applied: the order is still waiting for payment and no stock changed. Open the order in LAX Admin, then refund the buyer or put the order right.",
  shop_order_session_mismatch:
    "A Shop buyer paid in a payment session that is not the one their order was opened with. Nothing was applied: the order is still waiting for payment and no stock changed. Open the order in LAX Admin, then refund the buyer or put the order right.",
  shop_order_edition_state_invalid:
    "A Shop buyer paid, but the print held for their order was no longer reserved for it (it may have gone to another order). Nothing was applied: the order is still waiting for payment and no stock changed. Open the order in LAX Admin, then refund the buyer or find them the print.",
  shop_order_paid_twice:
    "A Shop order that was already paid received a second payment, in a different payment session. Nothing was applied to the order. Open the order in LAX Admin and refund the second payment.",
  private_sale_refund_after_payout:
    "Money went back to a private sale buyer after the seller's payout included the deal. The seller's payout may need adjusting.",
};

/** What one alert says: the money, the situation and where to look. */
export type UnappliedMoneyAlert = {
  situation: keyof typeof SITUATION;
  /** A hedged pointer to a payment the money might belong to; absent when none is certain enough. */
  possibleSource: string | null;
  paymentId: string | null;
  /** The private sale deal the money belongs to (PS-0012), when it is a deal's. */
  dealReference: string | null;
  /** The Shop order the money was paid for, when it is one's: its id, for the link to LAX Admin. */
  shopOrderId: string | null;
  reference: string;
  amountCents: number;
  currency: string;
};

export function alertFromUnappliedMoney(payload: UnappliedMoneyPayload): UnappliedMoneyAlert {
  return {
    situation: payload.reason,
    possibleSource: possibleSourceText(payload.possibleGroup ?? null),
    paymentId: payload.paymentId,
    dealReference: payload.privateSaleDealReference ?? null,
    shopOrderId: payload.shopOrderId ?? null,
    reference:
      payload.privateSaleDealReference ??
      payload.shopOrderReference ??
      payload.stripePaymentIntentId ??
      payload.stripeChargeId ??
      payload.stripeCustomerId ??
      payload.dedupeKey,
    amountCents: payload.amountCents,
    currency: payload.currency,
  };
}

export async function fanoutUnappliedMoney(options: {
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  emailService: IEmailService;
  adminEmailAddress?: string | undefined;
  webOrigin?: string | undefined;
  /**
   * LAX Admin's public address: a Shop order's task links to its page there, never to Bid admin.
   * Without it the alert still names LAX Admin and the order, and carries no link.
   */
  laxAdminUrl?: string | undefined;
  eventId: number;
  alert: UnappliedMoneyAlert;
}): Promise<void> {
  const { alert } = options;
  const origin = (value: string | undefined) => value?.replace(/\/$/, "") ?? "";
  // A Shop order's task is handled in LAX Admin, on its own origin, never in Bid admin.
  const base = alert.shopOrderId ? origin(options.laxAdminUrl) : origin(options.webOrigin);
  const path = alert.shopOrderId
    ? laxAdminRoutes.orders.order(alert.shopOrderId)
    : alert.dealReference
      ? adminRoutes.privateSales.deal(alert.dealReference)
      : alert.paymentId
        ? adminRoutes.payments.panel(alert.paymentId)
        : adminRoutes.payments.list();
  const amount =
    formatMoneyMajor(centsToAmount(alert.amountCents), alert.currency) ??
    `${alert.currency} ${centsToAmount(alert.amountCents)}`;
  const targets = await listStaffAlertTargets(
    { listRecipients: () => options.staffOpsRecipientReader.listRecipients(FINANCE_ACCESS) },
    options.adminEmailAddress,
  );
  for (const target of targets) {
    await options.emailService.enqueue({
      template: "payment-unapplied-money-admin-notice",
      to: target.to,
      ...(target.userId ? { userId: target.userId } : {}),
      ...(target.snapshot ? { recipientResolution: "snapshot" as const } : {}),
      vars: {
        recipientFirstName: target.firstName,
        situation: [SITUATION[alert.situation], alert.possibleSource].filter(Boolean).join(" "),
        amount,
        reference: alert.reference,
        // A Shop order with no LAX Admin address configured has no link to give.
        ...(alert.shopOrderId && !base ? {} : { reviewUrl: `${base}${path}` }),
      },
      category: "transactional",
      idempotencyKey: `payment-unapplied-money-admin-notice:${options.eventId}:${target.keySuffix}`,
    });
  }
}
