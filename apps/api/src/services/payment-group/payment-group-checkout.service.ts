import type { CheckoutRailKind } from "@auction/domain";
import type {
  IBidInvoiceReader,
  IPaymentGroupRepository,
  IUserRepository,
  PaymentGroupMember,
  PaymentGroupRecord,
} from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IStripeCustomerGateway } from "../interfaces/stripe-customer.js";
import { loadCheckedInvoiceLines } from "../payment/invoice-stripe-lines.js";
import type { OpenGroupCheckouts } from "./open-group-checkouts.js";
import type { IPaymentGroupGateway } from "./payment-group-ports.js";
import type {
  PaymentGroupReleaseReason,
  PaymentGroupSettlementService,
} from "./payment-group-settlement.service.js";

/**
 * Where the payment page sends the payer back: the Pay page for the same lots, which reads the
 * server's state rather than trusting this address. The address only says which way they left.
 */
export function payReturnUrl(
  webOrigin: string,
  members: readonly Pick<PaymentGroupMember, "lotId">[],
  returned: "success" | "cancelled",
): string {
  const lots = members.map((m) => encodeURIComponent(m.lotId)).join(",");
  return `${webOrigin}/purchases/pay?lots=${lots}&returned=${returned}`;
}

/** One invoice to settle in the group, as the validated plan picked it. */
export type GroupCheckoutInvoice = { paymentId: string; lotId: string; amount: string };

export type StartGroupCheckoutInput = {
  payerUserId: string;
  buyerLegalEntityId: string;
  currency: string;
  total: string;
  rail: CheckoutRailKind;
  invoices: readonly GroupCheckoutInvoice[];
};

export type StartedGroupCheckout = {
  paymentGroupId: string;
  checkoutUrl: string;
  rail: CheckoutRailKind;
};

export type GroupCheckoutError =
  /** Another payment took one of the invoices first; nothing was charged. */
  | "conflict"
  /** A payment for one of the invoices is finished or on its way; nothing new was opened. */
  | "in_progress"
  /** Online payment could not be opened just now; the invoices are due again on their own. */
  | "unavailable";

/** Ends an open single-invoice checkout so the invoice cannot be paid twice. */
export interface ISingleInvoiceCheckoutRevoker {
  revoke(paymentId: string): Promise<void>;
}

/** Makes sure each invoice exists in the accounting system before money is taken for it. */
export interface IGroupInvoiceAccounting {
  /** `false` when an invoice could not be created and accounting must come first. */
  ensureInvoices(paymentIds: readonly string[]): Promise<boolean>;
}

export type PaymentGroupCheckoutDeps = {
  groups: IPaymentGroupRepository;
  /** The stored invoices behind the members: the checkout is charged from their lines. */
  invoices: Pick<IBidInvoiceReader, "findByPaymentIds">;
  gateway: IPaymentGroupGateway;
  stripeCustomers: IStripeCustomerGateway;
  users: Pick<IUserRepository, "findById">;
  singleCheckouts: ISingleInvoiceCheckoutRevoker;
  /** Ends a checkout the payer walked away from, so the invoices can be paid another way. */
  openCheckouts: Pick<OpenGroupCheckouts, "endFor">;
  accounting: IGroupInvoiceAccounting;
  settlement: Pick<PaymentGroupSettlementService, "release">;
  events: IDomainEventSink;
  webOrigin: string;
};

/**
 * Opens the one checkout that pays several invoices: ends any checkout the payer left open for
 * them (never one that is finished or has money on its way), takes the invoices into a new group
 * (all or none), closes any single-invoice checkout still open for one of them, and issues the
 * group's checkout for the total by the rail the payer chose. If the checkout cannot be opened the group is let go at once, so no invoice is left
 * held by a payment nobody can make.
 */
export class PaymentGroupCheckoutService {
  constructor(private readonly deps: PaymentGroupCheckoutDeps) {}

  async start(
    input: StartGroupCheckoutInput,
  ): Promise<Result<StartedGroupCheckout, GroupCheckoutError>> {
    const paymentIds = input.invoices.map((i) => i.paymentId);
    const earlier = await this.deps.openCheckouts.endFor(paymentIds, input.payerUserId);
    if (earlier === "in_progress") {
      recordMoneyPathEvent("payment_group_start_refused_in_progress");
      return err("in_progress");
    }
    if (earlier === "unavailable") return err("unavailable");

    const claim = await this.deps.groups.claim({
      buyerLegalEntityId: input.buyerLegalEntityId,
      createdByUserId: input.payerUserId,
      currency: input.currency,
      totalAmount: input.total,
      checkoutRail: input.rail,
      paymentIds,
    });
    if (claim.kind === "conflict") {
      recordMoneyPathEvent("payment_group_claim_conflict");
      return err("conflict");
    }
    const group = claim.group;
    await this.deps.events.publish({
      aggregateType: "payment_group",
      aggregateId: group.id,
      eventType: "payment_group.created",
      payload: {
        paymentGroupId: group.id,
        buyerLegalEntityId: group.buyerLegalEntityId,
        payerUserId: input.payerUserId,
        total: group.totalAmount,
        currency: group.currency,
        checkoutRail: group.checkoutRail,
        members: input.invoices.map((i) => ({
          paymentId: i.paymentId,
          lotId: i.lotId,
          amount: i.amount,
        })),
      },
      actorUserId: input.payerUserId,
      actingLegalEntityId: group.buyerLegalEntityId,
    });

    for (const invoice of input.invoices) {
      await this.deps.singleCheckouts.revoke(invoice.paymentId);
    }

    if (!(await this.deps.accounting.ensureInvoices(paymentIds))) {
      return this.letGo(group.id, "accounting_unavailable");
    }

    const members = await this.deps.groups.listMembers(group.id);
    const session = await this.openCheckout(group, members, input.payerUserId);
    if (!session) return this.letGo(group.id, "checkout_unavailable");

    const recorded = await this.deps.groups.recordCheckout(group.id, {
      sessionId: session.sessionId,
      paymentIntentId: session.paymentIntentId,
    });
    if (!recorded) {
      // The group was let go while its checkout was being opened (another payment ended it):
      // that checkout must not be payable against a group that no longer holds the invoices.
      await this.deps.gateway.expireCheckout(session.sessionId);
      recordMoneyPathEvent("payment_group_checkout_orphaned");
      return err("conflict");
    }
    recordMoneyPathEvent(`payment_group_checkout_created_${input.rail}`);
    return ok({ paymentGroupId: group.id, checkoutUrl: session.url, rail: input.rail });
  }

  private async openCheckout(
    group: PaymentGroupRecord,
    members: readonly PaymentGroupMember[],
    payerUserId: string,
  ) {
    if (!this.deps.gateway.isConfigured()) return null;
    const payer = await this.deps.users.findById(payerUserId);
    if (!payer?.email) return null;
    const web = this.deps.webOrigin.replace(/\/$/, "");
    try {
      const stripeCustomerId =
        group.checkoutRail === "gb_bank_transfer"
          ? await this.deps.stripeCustomers.findOrCreateForLegalEntity({
              legalEntityId: group.buyerLegalEntityId,
              buyerEmail: payer.email,
              buyerName: payer.name,
            })
          : null;
      const checked = await loadCheckedInvoiceLines(
        this.deps.invoices,
        members.map((m) => ({ paymentId: m.paymentId, amountPence: gbpAmountToPence(m.amount) })),
      );
      return await this.deps.gateway.createCheckout({
        paymentGroupId: group.id,
        rail: group.checkoutRail,
        currency: group.currency,
        totalPence: gbpAmountToPence(group.totalAmount),
        lines: members.map((m) => ({
          paymentId: m.paymentId,
          lotId: m.lotId,
          lotTitle: m.lotTitle,
          lotNumber: m.lotNumber,
          amountPence: gbpAmountToPence(m.amount),
          invoiceLines: checked.get(m.paymentId)?.lines ?? [],
        })),
        buyerEmail: payer.email,
        stripeCustomerId,
        successUrl: payReturnUrl(web, members, "success"),
        cancelUrl: payReturnUrl(web, members, "cancelled"),
      });
    } catch (e) {
      console.error(
        JSON.stringify({
          msg: "payment_group_checkout_failed",
          paymentGroupId: group.id,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
      return null;
    }
  }

  private async letGo(
    groupId: string,
    reason: PaymentGroupReleaseReason,
  ): Promise<Result<StartedGroupCheckout, GroupCheckoutError>> {
    await this.deps.settlement.release({ eventId: null, groupId, reason });
    return err("unavailable");
  }
}
