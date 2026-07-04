import type { ILotSoftDeleteGuardReader } from "@auction/persistence/interfaces";
import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { bulkLotDeleteConfirmationPhrase, lotDeleteConfirmationPhrase } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../lib/errors.js";
import { CatalogSoftDeleteOrchestrator } from "./catalog/catalog-soft-delete-orchestrator.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotSoftDeleteSideEffects } from "./interfaces/lot-soft-delete.js";
import { LotSoftDeleteService } from "./lot-soft-delete.service.js";

function baseLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "l1",
    saleId: "s1",
    lotNumber: 1,
    title: "Evening lot",
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

function createService(input: {
  lotRepo?: ILotRepository;
  saleRepo?: ISaleRepository;
  guardReader?: ILotSoftDeleteGuardReader;
  sideEffects?: ILotSoftDeleteSideEffects;
  jobScheduler?: ILotJobScheduler | null;
  db?: unknown;
  domainEventSink?: IDomainEventSink | null;
}) {
  const jobScheduler = input.jobScheduler ?? null;
  const domainEventSink = input.domainEventSink ?? null;
  const orchestrator = new CatalogSoftDeleteOrchestrator(jobScheduler, domainEventSink as never);
  return new LotSoftDeleteService(
    input.lotRepo ?? ({} as ILotRepository),
    input.saleRepo ?? ({} as ISaleRepository),
    input.guardReader ?? ({} as ILotSoftDeleteGuardReader),
    input.sideEffects ?? ({} as ILotSoftDeleteSideEffects),
    orchestrator,
  );
}

describe("LotSoftDeleteService", () => {
  it("soft deletes draft lot and cancels lot jobs", async () => {
    const lotRow = baseLot();
    const saleRow = baseSale();
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const softDeleteLot = vi.fn().mockResolvedValue(undefined);
    const publish = vi.fn().mockResolvedValue(undefined);
    const domainEventSink = {
      publish,
      withTx: vi.fn().mockReturnValue({ publish }),
    } as unknown as IDomainEventSink;

    const lotRepo = {
      findById: vi.fn().mockResolvedValue(lotRow),
    } as unknown as ILotRepository;
    const saleRepo = {
      findById: vi.fn().mockResolvedValue(saleRow),
    } as unknown as ISaleRepository;
    const guardReader = {
      countGuardsForLot: vi
        .fn()
        .mockResolvedValue({ bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }),
    } as unknown as ILotSoftDeleteGuardReader;
    const sideEffects = { softDeleteLot } as unknown as ILotSoftDeleteSideEffects;
    const jobScheduler = { cancelLotJobs } as unknown as ILotJobScheduler;

    const svc = createService({
      lotRepo,
      saleRepo,
      guardReader,
      sideEffects,
      jobScheduler,
      domainEventSink,
    });

    const result = await svc.softDelete(
      "admin-1",
      "staff",
      "l1",
      lotDeleteConfirmationPhrase("Evening lot"),
      "auction_manager",
    );
    expect(result.isOk()).toBe(true);
    expect(cancelLotJobs).toHaveBeenCalledWith("l1");
    expect(softDeleteLot).toHaveBeenCalledWith(
      expect.objectContaining({ lotId: "l1", actorUserId: "admin-1" }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "lot.soft_deleted", aggregateId: "l1" }),
    );
  });

  it("denies client role", async () => {
    const svc = createService({});
    const result = await svc.softDelete(
      "u1",
      "client",
      "l1",
      lotDeleteConfirmationPhrase("Evening lot"),
      null,
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(AuthzError);
  });

  it("returns not found for missing lot", async () => {
    const lotRepo = { findById: vi.fn().mockResolvedValue(null) } as unknown as ILotRepository;
    const svc = createService({ lotRepo });
    const result = await svc.softDelete(
      "admin-1",
      "staff",
      "missing",
      lotDeleteConfirmationPhrase("Evening lot"),
      "auction_manager",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(LotError);
  });

  it("rejects confirmation phrase mismatch", async () => {
    const lotRow = baseLot({ title: "Evening lot" });
    const lotRepo = { findById: vi.fn().mockResolvedValue(lotRow) } as unknown as ILotRepository;
    const svc = createService({ lotRepo });
    const result = await svc.softDelete(
      "admin-1",
      "staff",
      "l1",
      "DELETE wrong title",
      "auction_manager",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LotError);
      expect(result.error.status).toBe(400);
    }
  });

  it("does not publish when side effects report concurrent delete", async () => {
    const lotRow = baseLot();
    const saleRow = baseSale();
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const softDeleteLot = vi.fn().mockRejectedValue(new LotError("Lot not found", 404));
    const publish = vi.fn().mockResolvedValue(undefined);

    const lotRepo = {
      findById: vi.fn().mockResolvedValue(lotRow),
    } as unknown as ILotRepository;
    const saleRepo = {
      findById: vi.fn().mockResolvedValue(saleRow),
    } as unknown as ISaleRepository;
    const guardReader = {
      countGuardsForLot: vi
        .fn()
        .mockResolvedValue({ bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }),
    } as unknown as ILotSoftDeleteGuardReader;
    const sideEffects = { softDeleteLot } as unknown as ILotSoftDeleteSideEffects;

    const svc = createService({
      lotRepo,
      saleRepo,
      guardReader,
      sideEffects,
      jobScheduler: { cancelLotJobs } as unknown as ILotJobScheduler,
      domainEventSink: {
        publish,
        withTx: vi.fn().mockReturnValue({ publish }),
      } as unknown as IDomainEventSink,
    });

    const result = await svc.softDelete(
      "admin-1",
      "staff",
      "l1",
      lotDeleteConfirmationPhrase("Evening lot"),
      "auction_manager",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LotError);
      expect(result.error.status).toBe(404);
    }
    expect(publish).not.toHaveBeenCalled();
  });

  it("batch delete eligibility skips non-draft lots", async () => {
    const draftLot = baseLot({ id: "l1", status: "draft" });
    const activeLot = baseLot({ id: "l2", status: "active", title: "Active" });
    const saleRow = baseSale();
    const guardsMap = new Map([
      ["l1", { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }],
    ]);
    const guardReader = {
      countGuardsForLots: vi.fn().mockResolvedValue(guardsMap),
    } as unknown as ILotSoftDeleteGuardReader;
    const saleRepo = {
      findByIds: vi.fn().mockResolvedValue([saleRow]),
    } as unknown as ISaleRepository;

    const svc = createService({ saleRepo, guardReader });

    const result = await svc.getDeleteEligibilityBatch([draftLot, activeLot]);

    expect(result.size).toBe(1);
    expect(result.get("l1")?.canDelete).toBe(true);
    expect(result.has("l2")).toBe(false);
    expect(guardReader.countGuardsForLots).toHaveBeenCalledWith([{ lotId: "l1", saleId: "s1" }]);
  });

  it("bulkSoftDelete deletes eligible lots and skips ineligible with per-id errors", async () => {
    const lot1 = baseLot({ id: "l1", title: "Lot one" });
    const lot2 = baseLot({ id: "l2", title: "Lot two", status: "active" });
    const saleRow = baseSale();
    const softDeleteLot = vi.fn().mockResolvedValue(undefined);
    const lotRepo = {
      findById: vi.fn(async (id: string) => (id === "l1" ? lot1 : id === "l2" ? lot2 : null)),
      findBySaleId: vi.fn().mockResolvedValue([lot1]),
    } as unknown as ILotRepository;
    const saleRepo = {
      findById: vi.fn().mockResolvedValue(saleRow),
      findByIds: vi.fn().mockResolvedValue([saleRow]),
    } as unknown as ISaleRepository;
    const guardReader = {
      countGuardsForLots: vi.fn().mockResolvedValue(
        new Map([
          ["l1", { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }],
          ["l2", { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }],
        ]),
      ),
    } as unknown as ILotSoftDeleteGuardReader;
    const sideEffects = { softDeleteLot } as unknown as ILotSoftDeleteSideEffects;

    const svc = createService({
      lotRepo,
      saleRepo,
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
      ["l1", "l2"],
      bulkLotDeleteConfirmationPhrase(2),
      "auction_manager",
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.attempted).toBe(2);
      expect(result.value.failed).toBe(1);
      expect(result.value.errors[0]?.lotId).toBe("l2");
      expect(softDeleteLot).toHaveBeenCalledTimes(1);
    }
  });

  it("bulkSoftDelete rejects wrong confirmation phrase", async () => {
    const svc = createService({});
    const result = await svc.bulkSoftDelete(
      "admin-1",
      "staff",
      ["l1"],
      "DELETE 1 DRAFT LOT",
      "auction_manager",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(400);
    }
  });
});
