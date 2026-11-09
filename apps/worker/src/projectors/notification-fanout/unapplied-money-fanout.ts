import {
  type UnappliedMoneyPayload,
  type UnappliedMoneyReason,
  possibleSourceText,
} from "@auction/domain";
import type { IEmailService } from "@auction/email";
import { formatMoneyMajor } from "@auction/email";
import { FINANCE_ACCESS, adminRoutes } from "@auction/types";
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
    reference:
      payload.privateSaleDealReference ??
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
  eventId: number;
  alert: UnappliedMoneyAlert;
}): Promise<void> {
  const { alert } = options;
  const base = options.webOrigin?.replace(/\/$/, "") ?? "";
  const path = alert.dealReference
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
        reviewUrl: `${base}${path}`,
      },
      category: "transactional",
      idempotencyKey: `payment-unapplied-money-admin-notice:${options.eventId}:${target.keySuffix}`,
    });
  }
}
