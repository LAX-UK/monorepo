import {
  type EntityActor,
  deliveryQuoteActionsFor,
  entityActorCan,
  purchaseDeliveryStage,
  purchaseInvoiceState,
  purchasePaymentRole,
} from "@auction/domain";
import type { AccountPurchaseFactsRow, DeliveryQuoteRow } from "@auction/persistence/interfaces";
import type {
  AccountPurchaseView,
  OrganisationBuyingError,
  OrganisationBuyingErrorCode,
  PurchaseQuoteView,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import {
  PAYMENT_ELIGIBILITY_HOLD,
  PAYMENT_ELIGIBILITY_REFUSAL,
} from "../payment/payment-eligibility.gate.js";

const STATUS: Record<OrganisationBuyingErrorCode, OrganisationBuyingError["status"]> = {
  insufficient_entity_role: 403,
  purchase_not_found: 404,
  quote_step_not_allowed: 409,
  quote_wrong_actor: 403,
  quote_changed: 409,
  problem_purchase_not_paid: 409,
  pay_several_empty: 400,
  pay_several_too_many: 400,
  pay_several_duplicate: 400,
  pay_several_nothing_payable: 409,
  pay_several_mixed_currency: 409,
  pay_several_payer_on_hold: 409,
  pay_several_winner_on_hold: 409,
  organisation_closed: PAYMENT_ELIGIBILITY_REFUSAL.organisation_closed.status,
  organisation_under_review: PAYMENT_ELIGIBILITY_HOLD.organisation_under_review.status,
  identity_verification_required: PAYMENT_ELIGIBILITY_HOLD.identity_verification_required.status,
  pay_several_below_minimum: 409,
  pay_several_over_limit: 409,
  pay_several_needs_finance_review: 409,
  pay_several_card_over_limit: 409,
  payment_in_progress_elsewhere: 409,
  pay_several_conflict: 409,
  pay_several_unavailable: 503,
  pay_plan_unavailable: 503,
  onboarding_required: 403,
  pay_plan_changed: 409,
};

const MESSAGE: Record<OrganisationBuyingErrorCode, string> = {
  insufficient_entity_role: "Your role in this account can't do this.",
  purchase_not_found: "This purchase isn't in this account.",
  quote_step_not_allowed: "This step isn't open for the delivery quote any more.",
  quote_wrong_actor: "The saleroom team takes this step.",
  quote_changed: "The delivery quote changed while you were looking. Refresh and try again.",
  problem_purchase_not_paid: "You can report a problem once the purchase is paid.",
  pay_several_empty: "Choose at least one invoice to pay.",
  pay_several_too_many: "Choose up to 20 invoices at a time.",
  pay_several_duplicate: "An invoice was chosen twice.",
  pay_several_nothing_payable: "None of the chosen invoices can be paid now.",
  pay_several_mixed_currency: "Invoices in different currencies are paid separately.",
  pay_several_payer_on_hold:
    "We need to complete a check on your account before you can pay. Our team will be in touch.",
  pay_several_winner_on_hold:
    "We need to complete a check on one of these purchases before it can be paid. Our team will be in touch.",
  organisation_closed: PAYMENT_ELIGIBILITY_REFUSAL.organisation_closed.message,
  organisation_under_review: PAYMENT_ELIGIBILITY_HOLD.organisation_under_review.message,
  identity_verification_required: PAYMENT_ELIGIBILITY_HOLD.identity_verification_required.message,
  pay_several_below_minimum: "The total is too small to pay online. Choose more invoices.",
  pay_several_over_limit:
    "The total is more than one online payment can take. Choose fewer invoices, or contact our settlements team.",
  pay_several_needs_finance_review:
    "The total is large enough that our finance team reviews it first. Choose fewer invoices, or pay them one at a time.",
  pay_several_card_over_limit:
    "The total is more than a card payment takes. Choose bank transfer, or choose fewer invoices.",
  payment_in_progress_elsewhere:
    "A payment for these invoices is already under way. Check its progress on the Pay page.",
  pay_several_conflict:
    "Some of these invoices started being paid in the meantime. Refresh and try again.",
  pay_several_unavailable:
    "Paying online isn't available just now. Nothing was charged. Try again shortly.",
  pay_plan_unavailable:
    "We couldn't check your payment just now. Nothing was charged. Try again shortly.",
  onboarding_required: "Finish setting up your account before you pay.",
  pay_plan_changed: "The total has changed. Check it and pay again.",
};

/** The one place buying errors get their status and wording. */
export function buyingError(code: OrganisationBuyingErrorCode): OrganisationBuyingError {
  return { code, status: STATUS[code], message: MESSAGE[code] };
}

/** The member as the capability table sees them. */
export function entityActorOf(actor: OrganisationMemberActor): EntityActor {
  return { role: actor.role, isImpersonation: actor.isImpersonation };
}

/** Whether the member moves the account's money: asks for and accepts quotes, pays invoices. */
export function memberIsPayer(actor: OrganisationMemberActor): boolean {
  return entityActorCan(entityActorOf(actor), "entity.finance.write");
}

export function quoteView(
  quote: DeliveryQuoteRow,
  actor: OrganisationMemberActor,
): PurchaseQuoteView {
  const { lotId: _lot, buyerLegalEntityId: _account, ...rest } = quote;
  return {
    ...rest,
    actions: memberIsPayer(actor) ? deliveryQuoteActionsFor(quote.status, "buyer") : [],
  };
}

function invoiceOf(row: AccountPurchaseFactsRow, now: Date, stillToSendPence: number | null) {
  const state = purchaseInvoiceState(
    {
      saleCancelled: row.fulfilment?.status === "cancelled",
      payment: row.payment
        ? {
            status: row.payment.status,
            raisedAt: row.payment.raisedAt,
            dueAt: row.payment.dueAt,
          }
        : null,
    },
    now,
  );
  return {
    status: state.status,
    dueAt: state.dueAt,
    paymentId: row.payment?.id ?? null,
    totalDue: row.payment?.amount ?? null,
    stillToSendPence,
  };
}

function paymentRoleOf(row: AccountPurchaseFactsRow, actor: OrganisationMemberActor) {
  return purchasePaymentRole({
    payerUserId: actor.userId,
    lot: { winnerId: row.wonBy?.userId ?? null, buyerAccountKind: row.buyerAccountKind },
    membership: entityActorOf(actor),
  });
}

/** A purchase row: the invoice and delivery stage worked out by the domain rules. */
export function purchaseView(
  row: AccountPurchaseFactsRow,
  actor: OrganisationMemberActor,
  now: Date,
  /** What a part-funded bank transfer still has to send for this invoice, when it is one. */
  stillToSendPence: number | null = null,
): AccountPurchaseView {
  const invoice = invoiceOf(row, now, stillToSendPence);
  return {
    lotId: row.lotId,
    lotTitle: row.lotTitle,
    lotNumber: row.lotNumber,
    sale: row.saleId ? { id: row.saleId, title: row.saleTitle } : null,
    hammerPrice: row.hammerPrice,
    wonBy: row.wonBy,
    wonAt: row.wonAt,
    paymentRole: paymentRoleOf(row, actor),
    invoice,
    delivery: {
      stage: purchaseDeliveryStage({
        invoice: invoice.status,
        fulfilment: row.fulfilment,
        quote: row.quote?.status ?? null,
      }),
      method: row.fulfilment?.method ?? null,
      carrier: row.fulfilment?.carrier ?? null,
      trackingNumber: row.fulfilment?.trackingNumber ?? null,
      collectedBy: row.fulfilment?.collectedBy ?? null,
      collectedAt: row.fulfilment?.collectedAt ?? null,
      quote: row.quote ? quoteView(row.quote, actor) : null,
    },
  };
}
