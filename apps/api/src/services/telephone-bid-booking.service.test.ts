import type { TelephoneBidBooking } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ITelephoneBidBookingDetailReader } from "../repositories/interfaces/telephone-bid-booking-detail.reader.js";
import type { ITelephoneBidBookingRepository } from "../repositories/interfaces/telephone-bid-booking.repository.js";
import type { ITelephoneBookingUserPhoneReader } from "../repositories/interfaces/telephone-booking-user-phone.reader.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
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

function mockSaleRepo(
  sale: { deliveryMode: string; status: string } | null = {
    deliveryMode: "onsite",
    status: "scheduled",
  },
): ISaleRepository {
  return {
    findById: vi.fn().mockResolvedValue(
      sale
        ? {
            id: "sale-1",
            deliveryMode: sale.deliveryMode,
            status: sale.status,
          }
        : null,
    ),
  } as never;
}

function mockLotRepo(
  lots: Array<{ id: string; saleId: string; deletedAt: null }> = [
    { id: "lot-1", saleId: "sale-1", deletedAt: null },
  ],
): ILotRepository {
  return {
    findByIds: vi.fn().mockResolvedValue(lots),
  } as never;
}

function mockUserPhoneReader(
  overrides: {
    mobile?: string | null;
    phoneNumber?: string | null;
    phoneNumberVerified?: boolean;
  } = {},
) {
  const mobile = "mobile" in overrides ? overrides.mobile : "+447700900123";
  const phoneNumber = "phoneNumber" in overrides ? overrides.phoneNumber : (mobile ?? null);
  const phoneNumberVerified =
    "phoneNumberVerified" in overrides ? overrides.phoneNumberVerified : true;

  return {
    findByUserId: vi.fn().mockResolvedValue({
      mobile,
      phoneNumber,
      phoneNumberVerified,
    }),
  } satisfies ITelephoneBookingUserPhoneReader;
}

function mockDetailReader(): ITelephoneBidBookingDetailReader {
  return {
    enrichForUser: vi.fn().mockImplementation(async (booking) => ({
      ...booking,
      saleTitle: "Test sale",
      linkedBids: [],
    })),
  };
}

function createService(input: {
  repo?: ITelephoneBidBookingRepository;
  legalEntity?: ReturnType<typeof mockLegalEntity>;
  sale?: { deliveryMode: string; status: string } | null;
  lots?: Array<{ id: string; saleId: string; deletedAt: null }>;
  phone?: {
    mobile?: string | null;
    phoneNumber?: string | null;
    phoneNumberVerified?: boolean;
  };
}) {
  return new TelephoneBidBookingService(
    {} as never,
    input.repo ?? mockRepo(),
    mockDetailReader(),
    mockSaleRepo(input.sale),
    mockLotRepo(input.lots),
    mockUserPhoneReader(input.phone),
    input.legalEntity ?? mockLegalEntity(),
  );
}

describe("TelephoneBidBookingService", () => {
  let repo: ITelephoneBidBookingRepository;

  beforeEach(() => {
    repo = mockRepo();
  });

  it("rejects request when sale is online", async () => {
    const service = createService({
      repo,
      sale: { deliveryMode: "online", status: "scheduled" },
    });
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
    const service = createService({
      repo,
      sale: { deliveryMode: "hybrid", status: "scheduled" },
    });
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
    const service = createService({
      repo,
      phone: { mobile: null, phoneNumber: null, phoneNumberVerified: false },
    });
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

  it("rejects request with unverified profile phone", async () => {
    const service = createService({
      repo,
      phone: { phoneNumberVerified: false },
    });
    const result = await service.requestBooking({
      userId: "user-1",
      saleId: "sale-1",
      buyerLegalEntityId: "le-1",
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("profile_phone_unverified");
    }
  });

  it("creates booking for valid onsite request", async () => {
    const service = createService({ repo });
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

  it("allows connect_pending buyer entity to request booking", async () => {
    const service = createService({
      repo,
      legalEntity: {
        findActiveMembership: vi.fn().mockResolvedValue({ role: "individual" }),
        findById: vi.fn().mockResolvedValue({ id: "le-1", status: "connect_pending" }),
      } as never,
    });
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

  it("rejects under_review buyer entity", async () => {
    const service = createService({
      repo,
      legalEntity: {
        findActiveMembership: vi.fn().mockResolvedValue({ role: "individual" }),
        findById: vi.fn().mockResolvedValue({ id: "le-1", status: "under_review" }),
      } as never,
    });
    const result = await service.requestBooking({
      userId: "user-1",
      saleId: "sale-1",
      buyerLegalEntityId: "le-1",
      lotIds: ["lot-1"],
      authorizedMax: 5000,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("entity_not_authorised");
    }
  });

  it("blocks buyer cancel after confirmed", async () => {
    repo = mockRepo({
      findByIdForUser: vi.fn().mockResolvedValue({ ...baseBooking(), status: "confirmed" }),
    });
    const service = createService({ repo });
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
    const service = createService({ repo });
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
    const service = createService({ repo });
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
    const service = createService({ repo });
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
    const service = createService({ repo });
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
