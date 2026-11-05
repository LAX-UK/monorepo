import { LotInvoiceInitiationService as WorkerLotInvoiceInitiationService } from "@auction/finance-runtime";
import type {
  ILegalEntityRepository,
  ILotRepository,
  IPaymentWriteRepository,
  ISaleRepository,
  IUserRepository,
} from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ISettlementCompliancePolicy } from "./aml/settlement-compliance.policy.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IInvoiceAccountingProvider } from "./interfaces/invoice-accounting.js";
import type { INotificationOutboxService } from "./interfaces/notification-outbox.js";
import { LotInvoiceInitiationService as ApiLotInvoiceInitiationService } from "./lot-invoice-initiation.service.js";
import { NotificationFactory } from "./notification.factory.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "./payment/payment-tier.policy.js";

/**
 * Characterises the two copies of "raise the invoice when a lot is sold": the API copy (backfill
 * cron) and the finance-runtime copy (worker, at lot end). The same scenarios run against both, so
 * every place they differ is asserted here rather than discovered in production.
 */

const tierPolicy = new PaymentTierPolicy(
  parsePaymentTierLimits({
    STRIPE_CARD_CHECKOUT_MAX: 10_000,
    STRIPE_MANUAL_REVIEW_MIN: 500_000,
    STRIPE_ABSOLUTE_MAX: 999_999.99,
  }),
);

const LOT_ID = "00000000-0000-4000-8000-000000000001";
const baseLot = {
  id: LOT_ID,
  title: "Blue Vase",
  status: "ended",
  winnerId: "buyer-1",
  buyerLegalEntityId: "00000000-0000-4000-8000-000000000010",
  sellerLegalEntityId: "00000000-0000-4000-8000-000000000020",
  saleId: null,
  currentPrice: "1000.00",
  buyerPremiumRate: "0.25",
} as unknown as Lot;

type Scenario = {
  lot?: Partial<Lot>;
  hold?: boolean;
  open?: { id: string } | null;
  refunded?: { id: string } | null;
};

function ports(scenario: Scenario) {
  const create = vi.fn(async (input: { amount: string; status: string }) => ({
    id: "pay-new",
    lotId: LOT_ID,
    amount: input.amount,
    status: input.status,
    createdAt: new Date("2026-06-26T12:00:00.000Z"),
  }));
  const stageDispatch = vi.fn().mockResolvedValue(undefined);
  const publish = vi.fn().mockResolvedValue(undefined);
  const ensureInvoiceForPayment = vi.fn().mockResolvedValue({ ok: true });
  const evaluate = vi
    .fn()
    .mockResolvedValue(
      scenario.hold ? { hold: true, reason: "aml_hold" } : { hold: false, reason: null },
    );
  return {
    calls: { create, stageDispatch, publish, ensureInvoiceForPayment, evaluate },
    lots: {
      findById: vi.fn().mockResolvedValue({ ...baseLot, ...scenario.lot }),
    } as unknown as ILotRepository,
    sales: { findById: vi.fn().mockResolvedValue(null) } as unknown as ISaleRepository,
    payments: {
      findOpenByLotAndBuyerAccount: vi.fn().mockResolvedValue(scenario.open ?? null),
      findRefundedByLotAndBuyerAccount: vi.fn().mockResolvedValue(scenario.refunded ?? null),
      create,
    } as unknown as IPaymentWriteRepository,
    compliance: { evaluate, peek: vi.fn() } as unknown as ISettlementCompliancePolicy,
    platformFee: {
      computePlatformFee: vi.fn(),
      computePlatformFeeFromPence: vi.fn().mockResolvedValue("62.50"),
    },
    accounting: {
      isConfigured: vi.fn().mockReturnValue(true),
      ensureInvoiceForPayment,
    } as unknown as IInvoiceAccountingProvider,
    outbox: { stageDispatch } as unknown as INotificationOutboxService,
    events: { publish, withTx: vi.fn().mockReturnValue({ publish }) } as IDomainEventSink,
    legalEntities: {
      findById: vi.fn().mockResolvedValue({ status: "active" }),
    } as unknown as ILegalEntityRepository,
    users: {
      findById: vi.fn().mockResolvedValue({ id: "buyer-1", email: "b@example.com", name: "B" }),
    } as unknown as IUserRepository,
  };
}

function apiCopy(scenario: Scenario) {
  const p = ports(scenario);
  const service = new ApiLotInvoiceInitiationService(
    p.lots,
    p.sales,
    p.payments,
    p.compliance,
    tierPolicy,
    p.platformFee,
    p.accounting,
    p.outbox,
    new NotificationFactory(),
    p.events,
    null,
    p.legalEntities,
    p.users,
  );
  return { service, calls: p.calls };
}

/** Wired as `apps/worker/src/finance/create-worker-lot-invoice-initiation.ts` wires it today. */
function workerCopy(scenario: Scenario, xeroWritesDisabled = false) {
  const p = ports(scenario);
  const service = new WorkerLotInvoiceInitiationService(
    p.lots,
    p.sales,
    p.payments,
    null,
    tierPolicy,
    p.platformFee,
    p.accounting,
    p.outbox,
    new NotificationFactory(),
    p.events,
    null,
    p.legalEntities,
    p.users,
    xeroWritesDisabled,
  );
  return { service, calls: p.calls };
}

const withoutLotId = ({ lotId: _lotId, ...rest }: { lotId?: string }) => rest;

describe("lot invoice initiation: API copy vs worker copy (current behaviour)", () => {
  const sameOutcome: [string, Scenario][] = [
    ["no winner", { lot: { winnerId: null } }],
    ["lot not ended", { lot: { status: "live" } as Partial<Lot> }],
    ["no buyer account", { lot: { buyerLegalEntityId: null } }],
    ["open payment already exists", { open: { id: "pay-open" } }],
    ["already refunded", { refunded: { id: "pay-refunded" } }],
  ];

  it.each(sameOutcome)("%s: same outcome, except the worker copy adds lotId", async (_n, s) => {
    const api = await apiCopy(s).service.ensureForLot(LOT_ID);
    const worker = await workerCopy(s).service.ensureForLot(LOT_ID);
    expect(withoutLotId(worker)).toEqual(api);
    expect(worker.lotId).toBe(LOT_ID);
    expect("lotId" in api).toBe(false);
  });

  it("a clear buyer: both freeze the same amount and fee, and stage the same notice", async () => {
    const api = apiCopy({});
    const worker = workerCopy({});
    await api.service.ensureForLot(LOT_ID);
    await worker.service.ensureForLot(LOT_ID);
    expect(worker.calls.create.mock.calls).toEqual(api.calls.create.mock.calls);
    expect(api.calls.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "1250.00", platformFee: "62.50", status: "pending" }),
    );
    expect(worker.calls.stageDispatch.mock.calls).toEqual(api.calls.stageDispatch.mock.calls);
    expect(worker.calls.ensureInvoiceForPayment.mock.calls).toEqual(
      api.calls.ensureInvoiceForPayment.mock.calls,
    );
  });

  it("DIFFERS: a buyer on an AML hold is held by the API copy but invoiced by the worker", async () => {
    const api = apiCopy({ hold: true });
    const worker = workerCopy({ hold: true });
    await api.service.ensureForLot(LOT_ID);
    await worker.service.ensureForLot(LOT_ID);
    expect(api.calls.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "requires_manual_review" }),
    );
    expect(api.calls.stageDispatch).not.toHaveBeenCalled();
    // The worker is built with no compliance policy, so the hold is never looked at.
    expect(worker.calls.evaluate).not.toHaveBeenCalled();
    expect(worker.calls.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
    expect(worker.calls.stageDispatch).toHaveBeenCalled();
  });

  it("DIFFERS: with Xero writes switched off the worker copy raises no invoice at all", async () => {
    const worker = workerCopy({}, true);
    const result = await worker.service.ensureForLot(LOT_ID);
    expect(result).toEqual({ created: false, reason: "xero_api_writes_disabled", lotId: LOT_ID });
    expect(worker.calls.create).not.toHaveBeenCalled();
  });
});
