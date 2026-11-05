import {
  type DealClearancePort,
  type DealMoneyBlocker,
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  dealPaymentBlockers,
  dealPaymentDueMinor,
  dealPaymentStartedEvent,
  partyIsClear,
} from "@auction/domain";
import type {
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealPaymentWriter,
  IPrivateSaleDealReader,
  IUserRepository,
} from "@auction/persistence/interfaces";
import type { PrivateSalePaymentRail } from "@auction/types";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IStripeCustomerGateway } from "../interfaces/stripe-customer.js";
import type { PaymentTierPolicy } from "../payment/payment-tier.policy.js";
import type { IDealCheckoutGateway } from "./deal-payment-ports.js";

export type StartDealPaymentError =
  | { kind: "not_found" }
  /** Only the person acting for the buyer pays. */
  | { kind: "forbidden" }
  | { kind: "blocked"; blockers: DealMoneyBlocker[] }
  /** The buyer's identity or screening is no longer clear, so no money is taken. */
  | { kind: "compliance_hold" }
  /** The amount is outside what the online rails accept; finance arranges the payment. */
  | { kind: "not_payable_online" }
  | { kind: "already_paid" }
  /** A bank transfer is on its way; nothing more to do. */
  | { kind: "in_progress" }
  | { kind: "unavailable" };

export type StartedDealPayment = {
  paymentId: string;
  checkoutUrl: string;
  rail: PrivateSalePaymentRail;
  amountMinor: number;
};

export type StartDealPaymentResult =
  | { ok: true; started: StartedDealPayment }
  | { ok: false; error: StartDealPaymentError };

export type DealPaymentDeps = {
  deals: Pick<IPrivateSaleDealReader, "findById">;
  payments: IPrivateSaleDealPaymentReader & IPrivateSaleDealPaymentWriter;
  clearance: DealClearancePort;
  tiers: Pick<PaymentTierPolicy, "resolveCheckoutRail" | "needsManualReviewGate">;
  gateway: IDealCheckoutGateway;
  stripeCustomers: IStripeCustomerGateway;
  users: Pick<IUserRepository, "findById">;
  events: IDomainEventSink;
  webOrigin: string;
};

/**
 * Opens the one checkout that pays a deal, once the invoice is issued. The amount is the price
 * plus any buyer's fee, the rail is chosen on it by the same tier policy as a lot invoice, and a
 * deal never has two live payments: asking again returns the checkout already open.
 */
export class DealPaymentService {
  constructor(private readonly deps: DealPaymentDeps) {}

  async start(input: { dealId: string; payerUserId: string }): Promise<StartDealPaymentResult> {
    const deal = await this.deps.deals.findById(input.dealId);
    if (!deal) return fail({ kind: "not_found" });
    const buyer = deal.buyer;
    if (!buyer || buyer.actingUserId !== input.payerUserId) return fail({ kind: "forbidden" });

    const blockers = dealPaymentBlockers(deal);
    if (blockers.length > 0) return fail({ kind: "blocked", blockers });

    const clearance = await this.deps.clearance.snapshot({
      dealId: deal.id,
      seller: { legalEntityId: deal.seller.legalEntityId, actingUserId: deal.seller.actingUserId },
      buyer: { legalEntityId: buyer.legalEntityId, actingUserId: buyer.actingUserId },
    });
    if (!clearance.buyer || !partyIsClear(clearance.buyer))
      return fail({ kind: "compliance_hold" });

    const amountMinor = dealPaymentDueMinor(deal);
    // Above the manual review amount, finance releases the payment, as for a lot invoice.
    const rail =
      amountMinor === null || this.deps.tiers.needsManualReviewGate(amountMinor, false)
        ? null
        : this.deps.tiers.resolveCheckoutRail(amountMinor);
    if (amountMinor === null || rail === null) return fail({ kind: "not_payable_online" });

    const claim = await this.deps.payments.claim({
      dealId: deal.id,
      buyerLegalEntityId: buyer.legalEntityId,
      createdByUserId: input.payerUserId,
      rail,
      amountMinor,
    });
    const payment = claim.payment;
    if (payment.status === "paid") return fail({ kind: "already_paid" });
    if (payment.status === "processing") return fail({ kind: "in_progress" });

    const payer = await this.deps.users.findById(input.payerUserId);
    const session = payer?.email
      ? await this.open(payment.id, deal, payment.rail, payment.amountMinor, {
          id: input.payerUserId,
          email: payer.email,
          name: payer.name,
          legalEntityId: buyer.legalEntityId,
        })
      : null;
    if (!session) {
      await this.deps.payments.markCancelled(payment.id);
      return fail({ kind: "unavailable" });
    }

    if (claim.kind === "created") {
      await this.deps.payments.recordCheckout(payment.id, session);
      const event = dealPaymentStartedEvent(deal, payment);
      await this.deps.events.publish({
        aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
        aggregateId: deal.id,
        eventType: event.eventType,
        payload: event.payload,
        actorUserId: input.payerUserId,
        actingLegalEntityId: buyer.legalEntityId,
      });
      recordMoneyPathEvent(`private_sale_checkout_created_${payment.rail}`);
    }
    return {
      ok: true,
      started: {
        paymentId: payment.id,
        checkoutUrl: session.url,
        rail: payment.rail,
        amountMinor: payment.amountMinor,
      },
    };
  }

  private async open(
    paymentId: string,
    deal: { id: string; reference: string },
    rail: PrivateSalePaymentRail,
    amountMinor: number,
    payer: { id: string; email: string; name: string; legalEntityId: string },
  ) {
    if (!this.deps.gateway.isConfigured()) return null;
    const web = this.deps.webOrigin.replace(/\/$/, "");
    try {
      const stripeCustomerId =
        rail === "gb_bank_transfer"
          ? await this.deps.stripeCustomers.findOrCreateForLegalEntity({
              legalEntityId: payer.legalEntityId,
              buyerEmail: payer.email,
              buyerName: payer.name,
            })
          : null;
      return await this.deps.gateway.createCheckout({
        paymentId,
        dealId: deal.id,
        reference: deal.reference,
        rail,
        currency: "GBP",
        amountPence: amountMinor,
        buyerEmail: payer.email,
        stripeCustomerId,
        successUrl: `${web}/purchases?payment=success&privateSale=${deal.reference}`,
        cancelUrl: `${web}/purchases?payment=cancelled&privateSale=${deal.reference}`,
      });
    } catch (e) {
      console.error(
        JSON.stringify({
          msg: "private_sale_checkout_failed",
          dealId: deal.id,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      return null;
    }
  }
}

const fail = (error: StartDealPaymentError): StartDealPaymentResult => ({ ok: false, error });
