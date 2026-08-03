import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { LegalEntity, Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { LotError } from "../lib/errors.js";
import { SaleStatusTransitionService } from "./sale-status-transition.service.js";

const saleId = "10000000-0000-4000-8000-000000000001";
const lotId = "20000000-0000-4000-8000-000000000002";
const sellerId = "30000000-0000-4000-8000-000000000003";

function saleWindow() {
  const saleStart = new Date(Date.now() + 86_400_000);
  const saleEnd = new Date(Date.now() + 172_800_000);
  return { saleStart, saleEnd };
}

function draftLot(window: ReturnType<typeof saleWindow>, overrides: Partial<Lot> = {}): Lot {
  const { saleStart, saleEnd } = window;
  return {
    id: lotId,
    saleId,
    lotNumber: 1,
    sellerLegalEntityId: sellerId,
    artistId: null,
    title: "Work",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "c1",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: saleStart,
    endTime: saleEnd,
    status: "draft",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

function draftSale(window: ReturnType<typeof saleWindow>, overrides: Partial<Sale> = {}): Sale {
  const { saleStart, saleEnd } = window;
  return {
    id: saleId,
    title: "Evening sale",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "online",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    heroPresentation: "cover",
    heroVideoUrl: null,
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
    startTime: saleStart,
    endTime: saleEnd,
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdBy: "admin-1",
    createdByLegalEntityId: sellerId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mkIndividualEntity(overrides: Partial<LegalEntity> = {}): LegalEntity {
  return {
    id: sellerId,
    displayName: "Seller",
    legalName: null,
    slug: null,
    kind: "individual",
    subkind: "private_collector",
    createdByUserId: "u1",
    status: "approved",
    statusChangedAt: null,
    statusChangedByUserId: null,
    stripeConnectAccountId: "acct_1",
    stripeCustomerId: null,
    stripeConnectChargesEnabled: true,
    stripeConnectPayoutsEnabled: true,
    stripeConnectRequirementsCurrentlyDue: [],
    stripeConnectRequirementsErrors: [],
    stripeConnectDisabledReason: null,
    xeroContactId: null,
    vatNumber: null,
    marginSchemeEligible: false,
    isLaxManaged: false,
    platformFeeBps: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SaleStatusTransitionService.setLotStatus", () => {
  it("returns connect_required when scheduling and seller entity is missing", async () => {
    const window = saleWindow();
    const lot = draftLot(window);
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(draftSale(window, { status: "scheduled" })),
    } as unknown as ISaleRepository;
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
      update: vi.fn(),
    } as unknown as ILotRepository;
    const legalEntityRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ILegalEntityRepository;

    const svc = new SaleStatusTransitionService(
      saleRepo,
      lotRepo,
      {
        scheduleLot: vi.fn(),
        cancelLotJobs: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      null,
      null,
      null,
      legalEntityRepository,
      true,
    );

    const result = await svc.setLotStatus(
      "staff",
      saleId,
      lotId,
      "scheduled",
      undefined,
      "super_admin",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({
        name: "LotError",
        code: "connect_required",
        status: 409,
      });
    }
    expect(lotRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("calls scheduleLot when scheduling a draft lot with future startTime", async () => {
    const window = saleWindow();
    const lot = draftLot(window);
    const scheduled: Lot = { ...lot, status: "scheduled" };
    const scheduleLot = vi.fn();
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValueOnce(lot).mockResolvedValueOnce(scheduled),
      updateStatus: vi.fn(),
      update: vi.fn(),
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(draftSale(window, { status: "scheduled" })),
    } as unknown as ISaleRepository;
    const legalEntityRepository = {
      findById: vi.fn().mockResolvedValue(mkIndividualEntity()),
    } as unknown as ILegalEntityRepository;

    const svc = new SaleStatusTransitionService(
      saleRepo,
      lotRepo,
      { scheduleLot, cancelLotJobs: vi.fn(), rescheduleEnd: vi.fn(), cancelLotEndJob: vi.fn() },
      null,
      null,
      null,
      legalEntityRepository,
      true,
    );

    const result = await svc.setLotStatus(
      "staff",
      saleId,
      lotId,
      "scheduled",
      undefined,
      "super_admin",
    );
    expect(result.isOk()).toBe(true);
    expect(lotRepo.updateStatus).toHaveBeenCalledWith(lotId, "scheduled");
    expect(scheduleLot).toHaveBeenCalledWith(lotId, scheduled.startTime, scheduled.endTime);
  });

  it("returns use_sale_publish when scheduling a lot in a draft sale", async () => {
    const window = saleWindow();
    const lot = draftLot(window);
    const scheduleLot = vi.fn();
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(draftSale(window)),
    } as unknown as ISaleRepository;

    const svc = new SaleStatusTransitionService(
      saleRepo,
      lotRepo,
      { scheduleLot, cancelLotJobs: vi.fn(), rescheduleEnd: vi.fn(), cancelLotEndJob: vi.fn() },
      null,
      null,
      null,
      null,
      false,
    );

    const result = await svc.setLotStatus(
      "staff",
      saleId,
      lotId,
      "scheduled",
      undefined,
      "super_admin",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.code).toBe("use_sale_publish");
      expect(result.error.status).toBe(409);
    }
    expect(lotRepo.updateStatus).not.toHaveBeenCalled();
    expect(scheduleLot).not.toHaveBeenCalled();
  });

  it("rejects scheduling when startTime is in the past", async () => {
    const saleStart = new Date(Date.now() - 7_200_000);
    const saleEnd = new Date(Date.now() + 86_400_000);
    const window = { saleStart, saleEnd };
    const lot = draftLot(window, {
      startTime: new Date(Date.now() - 3_600_000),
      endTime: new Date(Date.now() + 3_600_000),
    });
    const scheduleLot = vi.fn();
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(draftSale(window, { status: "scheduled" })),
    } as unknown as ISaleRepository;

    const svc = new SaleStatusTransitionService(
      saleRepo,
      lotRepo,
      { scheduleLot, cancelLotJobs: vi.fn(), rescheduleEnd: vi.fn(), cancelLotEndJob: vi.fn() },
      null,
      null,
      null,
      null,
      false,
    );

    const result = await svc.setLotStatus(
      "staff",
      saleId,
      lotId,
      "scheduled",
      undefined,
      "super_admin",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.message).toContain("startTime must be in the future to publish");
    }
    expect(lotRepo.updateStatus).not.toHaveBeenCalled();
    expect(scheduleLot).not.toHaveBeenCalled();
  });

  it("rejects cancelled status with use_dedicated_cancel", async () => {
    const window = saleWindow();
    const lot = draftLot(window);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(draftSale(window, { status: "scheduled" })),
    } as unknown as ISaleRepository;

    const svc = new SaleStatusTransitionService(
      saleRepo,
      lotRepo,
      {
        scheduleLot: vi.fn(),
        cancelLotJobs: vi.fn(),
        rescheduleEnd: vi.fn(),
        cancelLotEndJob: vi.fn(),
      },
      null,
      null,
      null,
      null,
      false,
    );

    const result = await svc.setLotStatus(
      "staff",
      saleId,
      lotId,
      "cancelled",
      undefined,
      "super_admin",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.code).toBe("use_dedicated_cancel");
    }
    expect(lotRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("reverts to draft when scheduleLot fails after commit", async () => {
    const window = saleWindow();
    const lot = draftLot(window);
    const scheduled: Lot = { ...lot, status: "scheduled" };
    const scheduleLot = vi.fn().mockRejectedValue(new Error("redis down"));
    const cancelLotJobs = vi.fn().mockResolvedValue(undefined);
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValueOnce(lot).mockResolvedValueOnce(scheduled),
      updateStatus: vi.fn(),
      update: vi.fn(),
    } as unknown as ILotRepository;
    const saleRepo: ISaleRepository = {
      findById: vi.fn().mockResolvedValue(draftSale(window, { status: "scheduled" })),
    } as unknown as ISaleRepository;
    const legalEntityRepository = {
      findById: vi.fn().mockResolvedValue(mkIndividualEntity()),
    } as unknown as ILegalEntityRepository;

    const svc = new SaleStatusTransitionService(
      saleRepo,
      lotRepo,
      { scheduleLot, cancelLotJobs, rescheduleEnd: vi.fn(), cancelLotEndJob: vi.fn() },
      null,
      null,
      null,
      legalEntityRepository,
      true,
    );

    const result = await svc.setLotStatus(
      "staff",
      saleId,
      lotId,
      "scheduled",
      undefined,
      "super_admin",
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error instanceof LotError) {
      expect(result.error.code).toBe("schedule_jobs_failed");
    }
    expect(lotRepo.updateStatus).toHaveBeenCalledWith(lotId, "scheduled");
    expect(lotRepo.updateStatus).toHaveBeenCalledWith(lotId, "draft");
    expect(cancelLotJobs).toHaveBeenCalledWith(lotId);
    expect(scheduleLot).toHaveBeenCalled();
  });
});
