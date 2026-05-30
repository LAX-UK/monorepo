import type { Lot, Sale } from "@auction/types";
import { saleDeleteConfirmationPhrase } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import { AuthzError, LotError } from "../lib/errors.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
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
    const sideEffects = {
      countGuardsForSale: vi
        .fn()
        .mockResolvedValue({ bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 }),
      softDeleteCascade,
    } as unknown as ISaleSoftDeleteSideEffects;
    const jobScheduler = { cancelLotJobs } as unknown as ILotJobScheduler;
    const domainEventPublisher = { publish } as unknown as DomainEventPublisher;

    const svc = new SaleSoftDeleteService(
      saleRepo,
      lotRepo,
      sideEffects,
      jobScheduler,
      {} as never,
      domainEventPublisher,
    );

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
      expect.anything(),
      expect.objectContaining({ eventType: "sale.soft_deleted", aggregateId: "s1" }),
    );
  });

  it("denies client role", async () => {
    const svc = new SaleSoftDeleteService(
      {} as ISaleRepository,
      {} as ILotRepository,
      {} as ISaleSoftDeleteSideEffects,
      null,
      null,
      null,
    );
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
    const svc = new SaleSoftDeleteService(
      saleRepo,
      {} as ILotRepository,
      {} as ISaleSoftDeleteSideEffects,
      null,
      null,
      null,
    );
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
    const svc = new SaleSoftDeleteService(
      saleRepo,
      {} as ILotRepository,
      {} as ISaleSoftDeleteSideEffects,
      null,
      null,
      null,
    );
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
    const sideEffects = {
      countGuardsForSale: vi.fn(),
      countGuardsForSales: vi.fn().mockResolvedValue(guardsMap),
      softDeleteCascade: vi.fn(),
    } as unknown as ISaleSoftDeleteSideEffects;

    const svc = new SaleSoftDeleteService(
      {} as ISaleRepository,
      {} as ILotRepository,
      sideEffects,
      null,
      null,
      null,
    );

    const result = await svc.getDeleteEligibilityBatch([
      { sale: draft, lots: [lotRow] },
      { sale: live, lots: [lotRow] },
    ]);

    expect(result.size).toBe(1);
    expect(result.get("s1")?.canDelete).toBe(true);
    expect(result.has("s2")).toBe(false);
    expect(sideEffects.countGuardsForSales).toHaveBeenCalledWith(["s1"]);
  });
});
