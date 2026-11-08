import type { Database } from "@auction/db";
import type {
  ClaimDealPaymentResult,
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealPaymentWriter,
  NewPrivateSaleDealPayment,
} from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail, PrivateSaleDealPayment } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { DealPaymentScope } from "./deal-payment-settlement.service.js";

const T = new Date("2026-11-03T10:00:00Z");

export function makeDeal(overrides: Partial<PrivateSaleDealDetail> = {}): PrivateSaleDealDetail {
  return {
    id: "deal-1",
    reference: "PS-0001",
    stage: "invoiced",
    itemSubmissionId: "sub-1",
    artworkRegisterId: null,
    sourceEnquiryId: null,
    sourceUnsoldLotChoiceId: null,
    ownerUserId: "u-owner",
    priceMinor: 4_800_000,
    buyerFeeBps: 0,
    sellerCommissionBps: 1500,
    costsMinor: 25_000,
    vatTreatment: "margin_scheme",
    partiesDisclosed: false,
    offerExpiresAt: null,
    paymentDueAt: new Date("2026-11-10T10:00:00Z"),
    collectionDueAt: null,
    agreedAt: T,
    agreedByUserId: "u-agree",
    invoicedByUserId: "u-invoice",
    invoiceReference: null,
    cancelReason: null,
    cancelledAt: null,
    version: 4,
    createdAt: T,
    updatedAt: T,
    seller: {
      role: "seller",
      legalEntityId: "le-seller",
      displayName: "Henry Lowe",
      actingUserId: "u-seller",
    },
    buyer: {
      role: "buyer",
      legalEntityId: "le-buyer",
      displayName: "Marlow Collection Ltd",
      actingUserId: "u-buyer",
    },
    documents: [],
    ...overrides,
  };
}

export function makePayment(
  overrides: Partial<PrivateSaleDealPayment> = {},
): PrivateSaleDealPayment {
  return {
    id: "pay-1",
    dealId: "deal-1",
    buyerLegalEntityId: "le-buyer",
    createdByUserId: "u-buyer",
    status: "open",
    rail: "gb_bank_transfer",
    currency: "GBP",
    amountMinor: 4_800_000,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeChargeId: null,
    recordedByUserId: null,
    bankReference: null,
    refundedMinor: 0,
    stripeRefundId: null,
    paidAt: null,
    refundedAt: null,
    createdAt: T,
    updatedAt: T,
    ...overrides,
  };
}

/** The deal payment store in memory, applying each move only from the statuses that may make it. */
export class InMemoryDealPayments
  implements IPrivateSaleDealPaymentReader, IPrivateSaleDealPaymentWriter
{
  rows: PrivateSaleDealPayment[] = [];
  private seq = 0;

  constructor(initial: PrivateSaleDealPayment[] = []) {
    this.rows = [...initial];
  }

  async findById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async findByIdForUpdate(id: string) {
    return this.findById(id);
  }
  async findLiveForDeal(dealId: string) {
    return (
      this.rows.find(
        (r) => r.dealId === dealId && ["open", "processing", "paid"].includes(r.status),
      ) ?? null
    );
  }
  async findByPaymentIntentId(id: string) {
    return this.rows.find((r) => r.stripePaymentIntentId === id) ?? null;
  }
  async findByChargeId(id: string) {
    return this.rows.find((r) => r.stripeChargeId === id) ?? null;
  }
  async listForDeal(dealId: string) {
    return this.rows.filter((r) => r.dealId === dealId);
  }
  async claim(input: NewPrivateSaleDealPayment): Promise<ClaimDealPaymentResult> {
    const live = await this.findLiveForDeal(input.dealId);
    if (live) return { kind: "existing", payment: live };
    this.seq += 1;
    const payment = makePayment({ id: `pay-new-${this.seq}`, ...input });
    this.rows.push(payment);
    return { kind: "created", payment };
  }
  async recordCheckout(id: string, c: { sessionId: string; paymentIntentId: string | null }) {
    this.patch(id, null, {
      stripeCheckoutSessionId: c.sessionId,
      stripePaymentIntentId: c.paymentIntentId,
    });
  }
  async markProcessing(id: string) {
    return this.patch(id, ["open"], { status: "processing" });
  }
  async markPaid(
    id: string,
    p: { chargeId: string | null; paymentIntentId: string | null; at: Date },
  ) {
    return this.patch(id, ["open", "processing"], {
      status: "paid",
      paidAt: p.at,
      stripeChargeId: p.chargeId,
      stripePaymentIntentId: p.paymentIntentId,
    });
  }
  async markCancelled(id: string) {
    return this.patch(id, ["open", "processing"], { status: "cancelled" });
  }
  async markPaidByTransfer(
    id: string,
    t: { recordedByUserId: string; bankReference: string; at: Date },
  ) {
    return this.patch(id, ["open"], {
      status: "paid",
      paidAt: t.at,
      recordedByUserId: t.recordedByUserId,
      bankReference: t.bankReference,
    });
  }
  async markPartlyRefunded(id: string, r: { refundedMinor: number; at: Date }) {
    const row = this.rows.find((p) => p.id === id);
    if (!row || row.status !== "paid" || r.refundedMinor <= row.refundedMinor) return null;
    if (r.refundedMinor >= row.amountMinor) return null;
    return this.patch(id, ["paid"], { refundedMinor: r.refundedMinor, refundedAt: r.at });
  }
  async markRefunded(id: string, r: { refundedMinor: number; refundId: string | null; at: Date }) {
    return this.patch(id, ["paid"], {
      status: "refunded",
      refundedMinor: r.refundedMinor,
      stripeRefundId: r.refundId,
      refundedAt: r.at,
    });
  }

  private patch(
    id: string,
    from: PrivateSaleDealPayment["status"][] | null,
    set: Partial<PrivateSaleDealPayment>,
  ): PrivateSaleDealPayment | null {
    const i = this.rows.findIndex((r) => r.id === id);
    const row = this.rows[i];
    if (!row || (from && !from.includes(row.status))) return null;
    const next = { ...row, ...set };
    this.rows[i] = next;
    return next;
  }
}

export type RecordedEvent = { eventType: string; payload: Record<string, unknown> };

export function recordingSink(): IDomainEventSink & { events: RecordedEvent[] } {
  const events: RecordedEvent[] = [];
  const sink: IDomainEventSink & { events: RecordedEvent[] } = {
    events,
    publish: async (e) => {
      events.push({ eventType: e.eventType, payload: e.payload });
    },
    withTx: () => sink,
  };
  return sink;
}

/** A scope over the given deal store; the transaction runner hands the same scope to every call. */
export function fakeScope(
  deal: PrivateSaleDealDetail | null,
  payments: InMemoryDealPayments,
  events: IDomainEventSink,
): DealPaymentScope {
  return {
    deals: {
      findById: async () => deal,
      findByReference: async () => deal,
      history: async () => [],
    } as unknown as DealPaymentScope["deals"],
    payments,
    events,
  };
}

export const inlineTransactions = {
  runInTransaction: async <T>(run: (tx: Database) => Promise<T>) => run({} as Database),
} as never;
