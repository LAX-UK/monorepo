import type { TelephoneBidBooking } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ITelephoneBidBookingRepository } from "../repositories/interfaces/telephone-bid-booking.repository.js";
import { TelephoneBidBookingService } from "./telephone-bid-booking.service.js";

const baseBooking = (): TelephoneBidBooking => ({
  id: "booking-1",
  saleId: "sale-1",
  userId: "user-1",
  buyerLegalEntityId: "le-1",
  phoneE164: "+447700900123",
  lotIds: ["lot-1"],
  authorizedMax: "5000.00",
  status: "requested",
  clerkUserId: null,
  notes: null,
  buyerNotes: null,
  approvedByUserId: null,
  completedLotIds: [],
  limitIncreaseRequestedAt: null,
  limitIncreaseAmount: null,
  cancelledAt: null,
  cancelledByUserId: null,
  cancellationReason: null,
  createdAt: new Date(),
  confirmedAt: null,
  updatedAt: new Date(),
});

function mockDb(
  overrides: {
    sale?: { deliveryMode: string; status: string } | null;
    mobile?: string | null;
    lots?: Array<{ id: string }>;
  } = {},
) {
  const saleRow = overrides.sale ?? { deliveryMode: "onsite", status: "scheduled" };
  const mobile = "mobile" in overrides ? overrides.mobile : "+447700900123";
  const lots = overrides.lots ?? [{ id: "lot-1" }];

  const chain = () => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockImplementation(async () => {
          return [];
        }),
      }),
    }),
  });

  const db = {
    select: vi.fn().mockImplementation((fields: Record<string, unknown>) => {
      const keys = Object.keys(fields);
      if (keys.includes("deliveryMode")) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(saleRow ? [saleRow] : []),
            }),
          }),
        };
      }
      if (keys.includes("mobile")) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ mobile }]),
            }),
          }),
        };
      }
      if (keys.includes("id") && keys.length === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(lots),
          }),
        };
      }
      return chain();
    }),
  };

  return db as never;
}

function mockRepo(
  overrides: Partial<ITelephoneBidBookingRepository> = {},
): ITelephoneBidBookingRepository {
  return {
    findById: vi.fn(),
    findByIdForUser: vi.fn(),
    findActiveForSaleUserEntity: vi.fn().mockResolvedValue(null),
    findMineForSale: vi.fn(),
    listMineForUser: vi.fn(),
    listForSaleAdmin: vi.fn(),
    listForCurrentLot: vi.fn(),
    insert: vi.fn().mockResolvedValue(baseBooking()),
    update: vi.fn(),
    countBySaleStatus: vi.fn(),
    countGlobalByStatus: vi.fn(),
    closeAllOpenForSale: vi.fn(),
    completeLinesForLot: vi.fn(),
    removeLotFromActiveBookings: vi.fn(),
    ...overrides,
  };
}

function mockLegalEntity() {
  return {
    findActiveMembership: vi.fn().mockResolvedValue({ role: "individual" }),
    findById: vi.fn().mockResolvedValue({ id: "le-1", status: "approved" }),
  } as never;
}

describe("TelephoneBidBookingService", () => {
  let repo: ITelephoneBidBookingRepository;

  beforeEach(() => {
    repo = mockRepo();
  });

  it("rejects request when sale is online", async () => {
    const service = new TelephoneBidBookingService(
      mockDb({ sale: { deliveryMode: "online", status: "scheduled" } }),
      repo,
      mockLegalEntity(),
    );
    const result = await service.requestBooking({
      userId: "user-1",
      saleId: "sale-1",
      buyerLegalEntityId: "le-1",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("onsite_sale_required");
    }
  });

  it("creates booking for valid hybrid request", async () => {
    const service = new TelephoneBidBookingService(
      mockDb({ sale: { deliveryMode: "hybrid", status: "scheduled" } }),
      repo,
      mockLegalEntity(),
    );
    const result = await service.requestBooking({
      userId: "user-1",
      saleId: "sale-1",
      buyerLegalEntityId: "le-1",
      lotIds: ["lot-1"],
      authorizedMax: 5000,
    });
    expect(result.isOk()).toBe(true);
    expect(repo.insert).toHaveBeenCalledOnce();
  });

  it("rejects request without profile phone", async () => {
    const service = new TelephoneBidBookingService(
      mockDb({ mobile: null }),
      repo,
      mockLegalEntity(),
    );
    const result = await service.requestBooking({
      userId: "user-1",
      saleId: "sale-1",
      buyerLegalEntityId: "le-1",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("profile_phone_required");
    }
  });

  it("creates booking for valid onsite request", async () => {
    const service = new TelephoneBidBookingService(mockDb(), repo, mockLegalEntity());
    const result = await service.requestBooking({
      userId: "user-1",
      saleId: "sale-1",
      buyerLegalEntityId: "le-1",
      lotIds: ["lot-1"],
      authorizedMax: 5000,
    });
    expect(result.isOk()).toBe(true);
    expect(repo.insert).toHaveBeenCalledOnce();
  });

  it("blocks buyer cancel after confirmed", async () => {
    repo = mockRepo({
      findByIdForUser: vi.fn().mockResolvedValue({ ...baseBooking(), status: "confirmed" }),
    });
    const service = new TelephoneBidBookingService(mockDb(), repo, mockLegalEntity());
    const result = await service.cancelByBuyer({
      bookingId: "booking-1",
      userId: "user-1",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("invalid_status_transition");
    }
  });

  it("enforces authorized max on telephone bid", async () => {
    repo = mockRepo({
      findById: vi.fn().mockResolvedValue({
        ...baseBooking(),
        status: "confirmed",
        authorizedMax: "1000.00",
      }),
    });
    const service = new TelephoneBidBookingService(mockDb(), repo, mockLegalEntity());
    const result = await service.assertBookingAllowsTelephoneBid({
      bookingId: "booking-1",
      saleId: "sale-1",
      lotId: "lot-1",
      amount: 1500,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("authorized_max_exceeded");
    }
  });

  it("allows telephone bid when lot is in booking scope", async () => {
    repo = mockRepo({
      findById: vi.fn().mockResolvedValue({
        ...baseBooking(),
        status: "confirmed",
        lotIds: ["lot-1"],
      }),
    });
    const service = new TelephoneBidBookingService(mockDb(), repo, mockLegalEntity());
    const result = await service.assertBookingAllowsTelephoneBid({
      bookingId: "booking-1",
      saleId: "sale-1",
      lotId: "lot-1",
      amount: 500,
    });
    expect(result.isOk()).toBe(true);
  });

  it("allows telephone bid when booking has no lot scope", async () => {
    repo = mockRepo({
      findById: vi.fn().mockResolvedValue({
        ...baseBooking(),
        status: "confirmed",
        lotIds: [],
      }),
    });
    const service = new TelephoneBidBookingService(mockDb(), repo, mockLegalEntity());
    const result = await service.assertBookingAllowsTelephoneBid({
      bookingId: "booking-1",
      saleId: "sale-1",
      lotId: "lot-99",
      amount: 500,
    });
    expect(result.isOk()).toBe(true);
  });

  it("rejects telephone bid when lot is outside booking scope", async () => {
    repo = mockRepo({
      findById: vi.fn().mockResolvedValue({
        ...baseBooking(),
        status: "confirmed",
        lotIds: ["lot-1"],
      }),
    });
    const service = new TelephoneBidBookingService(mockDb(), repo, mockLegalEntity());
    const result = await service.assertBookingAllowsTelephoneBid({
      bookingId: "booking-1",
      saleId: "sale-1",
      lotId: "lot-2",
      amount: 500,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("lot_not_in_booking");
    }
  });
});
