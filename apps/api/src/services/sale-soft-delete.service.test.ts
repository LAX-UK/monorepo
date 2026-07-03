import type { Lot, Sale } from "@auction/types";
import {
  bulkSaleDeleteConfirmationPhrase,
  saleDeleteConfirmationPhrase,
} from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../lib/errors.js";
import type { ISaleSoftDeleteGuardReader } from "../repositories/interfaces/sale-soft-delete-guard.reader.js";
import { CatalogSoftDeleteOrchestrator } from "./catalog/catalog-soft-delete-orchestrator.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type { ISaleSoftDeleteSideEffects } from "./interfaces/sale-soft-delete.js";
import { SaleSoftDeleteService } from "./sale-soft-delete.service.js";

function baseSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s1",
    title: "Evening",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "onsite",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    status: "draft",
    startTime: new Date(),
    endTime: new Date(),
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function baseLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "l1",
    saleId: "s1",
    lotNumber: 1,
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date(),
    endTime: new Date(),
    status: "draft",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  } as Lot;
}

function createService(input: {
  saleRepo?: ISaleRepository;
  lotRepo?: ILotRepository;
  guardReader?: ISaleSoftDeleteGuardReader;
  sideEffects?: ISaleSoftDeleteSideEffects;
  jobScheduler?: ILotJobScheduler | null;
  db?: unknown;
  domainEventSink?: IDomainEventSink | null;
}) {
  const jobScheduler = input.jobScheduler ?? null;
  const domainEventSink = input.domainEventSink ?? null;
  const orchestrator = new CatalogSoftDeleteOrchestrator(jobScheduler, domainEventSink as never);
  return new SaleSoftDeleteService(
    input.saleRepo ?? ({} as ISaleRepository),
    input.lotRepo ?? ({} as ILotRepository),
    input.guardReader ?? ({} as ISaleSoftDeleteGuardReader),
    input.sideEffects ?? ({} as ISaleSoftDeleteSideEffects),
    orchestrator,
  );
}

describe("SaleSoftDeleteService", () => {
  it("soft deletes draft sale and cancels lot jobs", async () => {
    const saleRow = baseSale();
    const lotRow = baseLot();
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const softDeleteCascade = vi.fn().mockResolvedValue(undefined);
    const publish = vi.fn().mockResolvedValue(undefined);

    const saleRepo = {
      findById: vi.fn().mockResolvedValue(saleRow),
    } as unknown as ISaleRepository;
    const lotRepo = {
      findBySaleId: vi.fn().mockResolvedValue([lotRow]),
    } as unknown as ILotRepository;
    const guardReader = {
      countGuardsForSale: vi
        .fn()
        .mockResolvedValue({ bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }),
    } as unknown as ISaleSoftDeleteGuardReader;
    const sideEffects = { softDeleteCascade } as unknown as ISaleSoftDeleteSideEffects;
    const jobScheduler = { cancelLotJobs } as unknown as ILotJobScheduler;
    const domainEventSink = {
      publish,
      withTx: vi.fn().mockReturnValue({ publish }),
    } as unknown as IDomainEventSink;

    const svc = createService({
      saleRepo,
      lotRepo,
      guardReader,
      sideEffects,
      jobScheduler,
      domainEventSink,
    });

    const result = await svc.softDelete(
      "admin-1",
      "staff",
      "s1",
      saleDeleteConfirmationPhrase("Evening"),
      "auction_manager",
    );
    expect(result.isOk()).toBe(true);
    expect(cancelLotJobs).toHaveBeenCalledWith("l1");
    expect(softDeleteCascade).toHaveBeenCalledWith(
      expect.objectContaining({ saleId: "s1", actorUserId: "admin-1", lotIds: ["l1"] }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "sale.soft_deleted", aggregateId: "s1" }),
    );
  });

  it("denies client role", async () => {
    const svc = createService({});
    const result = await svc.softDelete(
      "u1",
      "client",
      "s1",
      saleDeleteConfirmationPhrase("Evening"),
      null,
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(AuthzError);
  });

  it("returns not found for missing sale", async () => {
    const saleRepo = { findById: vi.fn().mockResolvedValue(null) } as unknown as ISaleRepository;
    const svc = createService({ saleRepo });
    const result = await svc.softDelete(
      "admin-1",
      "staff",
      "missing",
      saleDeleteConfirmationPhrase("Evening"),
      "auction_manager",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(LotError);
  });

  it("rejects confirmation phrase mismatch", async () => {
    const saleRow = baseSale({ title: "Evening Sale" });
    const saleRepo = { findById: vi.fn().mockResolvedValue(saleRow) } as unknown as ISaleRepository;
    const svc = createService({ saleRepo });
    const result = await svc.softDelete(
      "admin-1",
      "staff",
      "s1",
      "DELETE wrong title",
      "auction_manager",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LotError);
      expect(result.error.status).toBe(400);
    }
  });

  it("batch delete eligibility skips non-draft sales", async () => {
    const draft = baseSale({ id: "s1", status: "draft" });
    const live = baseSale({ id: "s2", status: "active", title: "Live" });
    const lotRow = baseLot();
    const guardsMap = new Map([
      ["s1", { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }],
    ]);
    const guardReader = {
      countGuardsForSales: vi.fn().mockResolvedValue(guardsMap),
    } as unknown as ISaleSoftDeleteGuardReader;

    const svc = createService({ guardReader });

    const result = await svc.getDeleteEligibilityBatch([
      { sale: draft, lots: [lotRow] },
      { sale: live, lots: [lotRow] },
    ]);

    expect(result.size).toBe(1);
    expect(result.get("s1")?.canDelete).toBe(true);
    expect(result.has("s2")).toBe(false);
    expect(guardReader.countGuardsForSales).toHaveBeenCalledWith(["s1"]);
  });

  it("bulkSoftDelete deletes eligible sales and reports ineligible per id", async () => {
    const draft = baseSale({ id: "s1", title: "Draft sale" });
    const live = baseSale({ id: "s2", title: "Live sale", status: "active" });
    const lotRow = baseLot();
    const softDeleteCascade = vi.fn().mockResolvedValue(undefined);
    const saleRepo = {
      findById: vi.fn(async (id: string) => (id === "s1" ? draft : id === "s2" ? live : null)),
    } as unknown as ISaleRepository;
    const lotRepo = {
      findBySaleId: vi.fn().mockResolvedValue([lotRow]),
    } as unknown as ILotRepository;
    const guardReader = {
      countGuardsForSales: vi.fn().mockResolvedValue(
        new Map([
          ["s1", { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }],
          ["s2", { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }],
        ]),
      ),
    } as unknown as ISaleSoftDeleteGuardReader;
    const sideEffects = { softDeleteCascade } as unknown as ISaleSoftDeleteSideEffects;

    const svc = createService({
      saleRepo,
      lotRepo,
      guardReader,
      sideEffects,
      jobScheduler: {
        cancelLotJobs: vi.fn(),
        cancelLotEndJob: vi.fn(),
      } as unknown as ILotJobScheduler,
      domainEventSink: {
        publish: vi.fn(),
        withTx: vi.fn().mockReturnValue({ publish: vi.fn() }),
      } as unknown as IDomainEventSink,
    });

    const result = await svc.bulkSoftDelete(
      "admin-1",
      "staff",
      ["s1", "s2"],
      bulkSaleDeleteConfirmationPhrase(2),
      "auction_manager",
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.attempted).toBe(2);
      expect(result.value.failed).toBe(1);
      expect(result.value.errors[0]?.saleId).toBe("s2");
      expect(softDeleteCascade).toHaveBeenCalledTimes(1);
    }
  });
});
