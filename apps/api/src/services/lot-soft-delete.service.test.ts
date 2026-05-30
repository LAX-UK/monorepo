import type { Lot, Sale } from "@auction/types";
import { lotDeleteConfirmationPhrase } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../lib/errors.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotSoftDeleteSideEffects } from "./interfaces/lot-soft-delete.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
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

describe("LotSoftDeleteService", () => {
  it("soft deletes draft lot and cancels lot jobs", async () => {
    const lotRow = baseLot();
    const saleRow = baseSale();
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const softDeleteLot = vi.fn().mockResolvedValue(undefined);
    const publish = vi.fn().mockResolvedValue(undefined);

    const lotRepo = {
      findById: vi.fn().mockResolvedValue(lotRow),
    } as unknown as ILotRepository;
    const saleRepo = {
      findById: vi.fn().mockResolvedValue(saleRow),
    } as unknown as ISaleRepository;
    const sideEffects = {
      countGuardsForLot: vi
        .fn()
        .mockResolvedValue({ bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }),
      softDeleteLot,
    } as unknown as ILotSoftDeleteSideEffects;
    const jobScheduler = { cancelLotJobs } as unknown as ILotJobScheduler;
    const domainEventPublisher = { publish } as unknown as DomainEventPublisher;

    const svc = new LotSoftDeleteService(
      lotRepo,
      saleRepo,
      sideEffects,
      jobScheduler,
      {} as never,
      domainEventPublisher,
    );

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
      expect.anything(),
      expect.objectContaining({ eventType: "lot.soft_deleted", aggregateId: "l1" }),
    );
  });

  it("denies client role", async () => {
    const svc = new LotSoftDeleteService(
      {} as ILotRepository,
      {} as ISaleRepository,
      {} as ILotSoftDeleteSideEffects,
      null,
      null,
      null,
    );
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
    const svc = new LotSoftDeleteService(
      lotRepo,
      {} as ISaleRepository,
      {} as ILotSoftDeleteSideEffects,
      null,
      null,
      null,
    );
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
    const svc = new LotSoftDeleteService(
      lotRepo,
      {} as ISaleRepository,
      {} as ILotSoftDeleteSideEffects,
      null,
      null,
      null,
    );
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
    const sideEffects = {
      countGuardsForLot: vi
        .fn()
        .mockResolvedValue({ bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }),
      softDeleteLot,
    } as unknown as ILotSoftDeleteSideEffects;

    const svc = new LotSoftDeleteService(
      lotRepo,
      saleRepo,
      sideEffects,
      { cancelLotJobs } as unknown as ILotJobScheduler,
      null,
      { publish } as unknown as DomainEventPublisher,
    );

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
});
