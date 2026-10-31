import {
  type EntityActor,
  type PaySeveralCandidate,
  type PurchaseInvoiceStatus,
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

const STATUS: Record<OrganisationBuyingErrorCode, OrganisationBuyingError["status"]> = {
  insufficient_entity_role: 403,
  purchase_not_found: 404,
  quote_step_not_allowed: 409,
  quote_wrong_actor: 403,
  quote_changed: 409,
  pay_several_empty: 400,
  pay_several_too_many: 400,
  pay_several_duplicate: 400,
  pay_several_nothing_payable: 409,
  pay_several_mixed_currency: 409,
  pay_several_payer_on_hold: 409,
  pay_several_below_minimum: 409,
  pay_several_over_limit: 409,
  pay_several_needs_finance_review: 409,
  pay_several_conflict: 409,
  pay_several_unavailable: 503,
};

const MESSAGE: Record<OrganisationBuyingErrorCode, string> = {
  insufficient_entity_role: "Your role in this account can't do this.",
  purchase_not_found: "This purchase isn't in this account.",
  quote_step_not_allowed: "This step isn't open for the delivery quote any more.",
  quote_wrong_actor: "The saleroom team takes this step.",
  quote_changed: "The delivery quote changed while you were looking. Refresh and try again.",
  pay_several_empty: "Choose at least one invoice to pay.",
  pay_several_too_many: "Choose up to 20 invoices at a time.",
  pay_several_duplicate: "An invoice was chosen twice.",
  pay_several_nothing_payable: "None of the chosen invoices can be paid now.",
  pay_several_mixed_currency: "Invoices in different currencies are paid separately.",
  pay_several_payer_on_hold:
    "We need to complete a check on your account before you can pay. Our team will be in touch.",
  pay_several_below_minimum: "The total is too small to pay online. Choose more invoices.",
  pay_several_over_limit:
    "The total is more than one online payment can take. Choose fewer invoices, or contact our settlements team.",
  pay_several_needs_finance_review:
    "The total is large enough that our finance team reviews it first. Choose fewer invoices, or pay them one at a time.",
  pay_several_conflict:
    "Some of these invoices started being paid in the meantime. Refresh and try again.",
  pay_several_unavailable:
    "Paying online isn't available just now. Nothing was charged. Try again shortly.",
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

function invoiceOf(row: AccountPurchaseFactsRow, now: Date) {
  const state = purchaseInvoiceState(
    {
      payment: row.payment ? { status: row.payment.status, raisedAt: row.payment.raisedAt } : null,
    },
    now,
  );
  return {
    status: state.status,
    dueAt: state.dueAt,
    paymentId: row.payment?.id ?? null,
    totalDue: row.payment?.amount ?? null,
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
): AccountPurchaseView {
  const invoice = invoiceOf(row, now);
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

/** A purchase as the pay-several rule sees it. */
export function paySeveralCandidate(
  view: AccountPurchaseView,
  accountId: string,
  currency: string,
  flags: Pick<PaySeveralCandidate, "heldForReview" | "inPaymentInProgress">,
): PaySeveralCandidate {
  const invoice: PurchaseInvoiceStatus = view.invoice.status;
  return {
    lotId: view.lotId,
    paymentId: view.invoice.paymentId,
    buyerAccountId: accountId,
    invoice,
    payerMayPay: view.paymentRole === "payer",
    totalDue: view.invoice.totalDue,
    currency,
    ...flags,
  };
}
