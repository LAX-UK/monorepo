import type { OnsiteEvent, OnsiteEventRsvp, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { encryptCheckInToken } from "../lib/check-in-token-ciphertext.js";
import { issueCheckInToken } from "../lib/onsite-event-check-in-token.js";
import type { IOnsiteEventRsvpRepository } from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import type { ISaleRepository } from "../repositories/interfaces/sale.repository.js";
import type { IOnsiteEventNotifier } from "./interfaces/onsite-event-notifier.js";
import { OnsiteEventAdminService } from "./onsite-event-admin.service.js";
import { OnsiteEventPassTokenService } from "./onsite-event-pass-token.service.js";
import { OnsiteEventSaleLinkService } from "./onsite-event-sale-link.service.js";

const TEST_CIPHER_SECRET = "test-secret-with-enough-length-for-scrypt";

function mockSaleRepo(row: Pick<Sale, "id" | "title" | "deliveryMode"> | null): ISaleRepository {
  return {
    findById: vi.fn().mockResolvedValue(
      row
        ? ({
            ...row,
            description: null,
            coverImages: [],
            categoryId: null,
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
            status: "scheduled",
            startTime: new Date(),
            endTime: new Date(),
            previewStartTime: null,
            buyerPremiumRate: "0",
            buyerPremiumTiers: null,
            terms: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } satisfies Sale)
        : null,
    ),
    findByIds: vi.fn(),
    create: vi.fn(),
    list: vi.fn(),
    countMatching: vi.fn(),
    findWithStatuses: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    countCreatedAtByDay: vi.fn(),
  };
}

const lax001Event = (): OnsiteEvent => ({
  slug: "lax001",
  title: "LAX 001: The First Hammer",
  startsAt: new Date("2026-06-18T18:00:00.000Z"),
  rsvpCloseAt: new Date("2099-01-01T00:00:00.000Z"),
  segmentOptions: [
    { value: "full_evening", label: "Full evening" },
    { value: "auction_only", label: "Auction & preview" },
    { value: "gala_only", label: "Gala only" },
  ],
  opsEmail: "events@lax.bid",
  micrositeUrl: "https://event.lax.bid",
  venue: null,
  dressCode: null,
  arrivalNote: null,
  status: "published",
  checkInDryRun: false,
  saleId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const baseRsvp = (): OnsiteEventRsvp => ({
  id: "rsvp-1",
  eventSlug: "lax001",
  userId: "user-1",
  attendanceSegment: "full_evening",
  plusOne: 0,
  plusOneGuestName: null,
  notes: null,
  checkInTokenHash: "hash",
  checkInTokenIssuedAt: new Date("2026-06-01T12:00:00.000Z"),
  checkInTokenCiphertext: null,
  checkedInAt: null,
  checkedInByUserId: null,
  checkInPartyCount: null,
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
  updatedAt: new Date("2026-06-01T12:00:00.000Z"),
});

function mockEventRepo(overrides: Partial<IOnsiteEventRepository> = {}): IOnsiteEventRepository {
  return {
    findBySlug: vi.fn().mockResolvedValue(lax001Event()),
    findBySaleId: vi.fn().mockResolvedValue(null),
    listAdminItems: vi.fn().mockResolvedValue([]),
    listPublicUpcoming: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    updateCheckInDryRun: vi.fn(),
    ...overrides,
  };
}

function mockRepo(overrides: Partial<IOnsiteEventRsvpRepository> = {}): IOnsiteEventRsvpRepository {
  return {
    findByEventAndUser: vi.fn().mockResolvedValue(null),
    findByIdWithGuest: vi.fn().mockResolvedValue(null),
    findByTokenHash: vi.fn().mockResolvedValue(null),
    listAdminRows: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(baseRsvp()),
    updateCheckInToken: vi.fn().mockResolvedValue(baseRsvp()),
    issueTokenIfMissing: vi.fn().mockResolvedValue(null),
    atomicCheckIn: vi.fn().mockResolvedValue(null),
    searchForCheckIn: vi.fn().mockResolvedValue([]),
    countCheckInStats: vi.fn().mockResolvedValue({ total: 0, checkedIn: 0 }),
    ...overrides,
  };
}

/** No test here that doesn't pass its own sale repo exercises cross-domain sale lookups. */
function saleLinkService(eventRepo: IOnsiteEventRepository, sales: ISaleRepository | null = null) {
  return new OnsiteEventSaleLinkService(eventRepo, sales);
}

function tokenService(secret: string | null = null) {
  return new OnsiteEventPassTokenService(secret);
}

function buildService(
  eventRepo: IOnsiteEventRepository,
  rsvpRepo: IOnsiteEventRsvpRepository,
  opts: {
    notifier?: IOnsiteEventNotifier | null;
    cipherSecret?: string | null;
    db?: ISaleRepository | null;
  } = {},
) {
  return new OnsiteEventAdminService(
    eventRepo,
    rsvpRepo,
    saleLinkService(eventRepo, opts.db ?? null),
    tokenService(opts.cipherSecret ?? null),
    opts.notifier ?? null,
  );
}

describe("OnsiteEventAdminService", () => {
  it("getAdminEventDetail returns admin metadata and arrival counts", async () => {
    const service = buildService(
      mockEventRepo(),
      mockRepo({ countCheckInStats: vi.fn().mockResolvedValue({ total: 12, checkedIn: 4 }) }),
    );

    const result = await service.getAdminEventDetail("lax001");

    expect(result).toEqual({
      slug: "lax001",
      title: "LAX 001: The First Hammer",
      status: "published",
      startsAt: "2026-06-18T18:00:00.000Z",
      rsvpCloseAt: "2099-01-01T00:00:00.000Z",
      segmentOptions: lax001Event().segmentOptions,
      micrositeUrl: "https://event.lax.bid",
      venue: null,
      dressCode: null,
      arrivalNote: null,
      opsEmail: "events@lax.bid",
      checkInDryRun: false,
      rsvpCount: 12,
      checkedInCount: 4,
      saleId: null,
    });
  });

  it("resendPass persists a new token before sending email", async () => {
    let tokenPersisted = false;
    const updateCheckInToken = vi.fn().mockImplementation(async () => {
      tokenPersisted = true;
      return baseRsvp();
    });
    const notifyResent = vi.fn().mockImplementation(async () => {
      expect(tokenPersisted).toBe(true);
    });
    const notifier: IOnsiteEventNotifier = {
      notifyResent,
      notifySubmitted: vi.fn(),
      notifyUpdated: vi.fn(),
    };
    const service = buildService(
      mockEventRepo(),
      mockRepo({
        findByIdWithGuest: vi.fn().mockResolvedValue({
          ...baseRsvp(),
          guestEmail: "guest@example.com",
          guestName: "Guest User",
          checkInTokenCiphertext: null,
        }),
        updateCheckInToken,
      }),
      { notifier, cipherSecret: TEST_CIPHER_SECRET },
    );

    const result = await service.resendPass("lax001", "rsvp-1");

    expect(result).toEqual({ ok: true, rotated: true, emailSent: true });
    expect(notifyResent).toHaveBeenCalledTimes(1);
    expect(updateCheckInToken).toHaveBeenCalledTimes(1);
  });

  it("resendPass persists token before email and returns error when email fails", async () => {
    const updateCheckInToken = vi.fn().mockResolvedValue(baseRsvp());
    const notifier: IOnsiteEventNotifier = {
      notifyResent: vi.fn().mockRejectedValue(new Error("smtp down")),
      notifySubmitted: vi.fn(),
      notifyUpdated: vi.fn(),
    };
    const service = buildService(
      mockEventRepo(),
      mockRepo({
        findByIdWithGuest: vi.fn().mockResolvedValue({
          ...baseRsvp(),
          guestEmail: "guest@example.com",
          guestName: "Guest User",
          checkInTokenCiphertext: null,
        }),
        updateCheckInToken,
      }),
      { notifier, cipherSecret: TEST_CIPHER_SECRET },
    );

    const result = await service.resendPass("lax001", "rsvp-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("pass_token_saved_email_failed");
      expect(result.error.message).toContain("previous link no longer works");
    }
    expect(updateCheckInToken).toHaveBeenCalledTimes(1);
  });

  it("resendPass does not send email when token persistence fails", async () => {
    const notifyResent = vi.fn();
    const notifier: IOnsiteEventNotifier = {
      notifyResent,
      notifySubmitted: vi.fn(),
      notifyUpdated: vi.fn(),
    };
    const service = buildService(
      mockEventRepo(),
      mockRepo({
        findByIdWithGuest: vi.fn().mockResolvedValue({
          ...baseRsvp(),
          guestEmail: "guest@example.com",
          guestName: "Guest User",
          checkInTokenCiphertext: null,
        }),
        updateCheckInToken: vi.fn().mockResolvedValue(null),
      }),
      { notifier, cipherSecret: TEST_CIPHER_SECRET },
    );

    const result = await service.resendPass("lax001", "rsvp-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("token_update_failed");
    }
    expect(notifyResent).not.toHaveBeenCalled();
  });

  it("resendPass fails when notifier is not configured", async () => {
    const service = buildService(
      mockEventRepo(),
      mockRepo({
        findByIdWithGuest: vi.fn().mockResolvedValue({
          ...baseRsvp(),
          guestEmail: "guest@example.com",
          guestName: "Guest User",
          checkInTokenCiphertext: encryptCheckInToken(
            issueCheckInToken().plainToken,
            TEST_CIPHER_SECRET,
          ),
        }),
      }),
      { cipherSecret: TEST_CIPHER_SECRET },
    );

    const result = await service.resendPass("lax001", "rsvp-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("pass_email_not_configured");
    }
  });

  it("exports admin csv", async () => {
    const service = buildService(
      mockEventRepo(),
      mockRepo({
        listAdminRows: vi.fn().mockResolvedValue([
          {
            id: "rsvp-1",
            name: "Guest User",
            email: "guest@example.com",
            attendanceSegment: "full_evening",
            plusOne: 0,
            plusOneGuestName: null,
            notes: null,
            checkedInAt: null,
            checkInPartyCount: null,
            createdAt: "2026-06-01T12:00:00.000Z",
            updatedAt: "2026-06-01T12:00:00.000Z",
          },
        ]),
      }),
    );
    const csv = await service.exportAdminCsv("lax001");
    expect(typeof csv).toBe("string");
    expect(csv).toContain("guest@example.com");
  });

  describe("validateLinkedSale via createAdminEvent/updateAdminEvent", () => {
    const createBody = (saleId: string | null) => ({
      slug: "lax002",
      title: "LAX 002: Second Evening",
      startsAt: null,
      rsvpCloseAt: null,
      segmentOptions: [{ value: "full_evening", label: "Full evening" }],
      opsEmail: null,
      micrositeUrl: null,
      venue: null,
      dressCode: null,
      arrivalNote: null,
      status: "draft" as const,
      saleId,
    });

    it("createAdminEvent rejects a sale already linked to another event", async () => {
      const eventRepo = mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue(null),
        findBySaleId: vi.fn().mockResolvedValue({ ...lax001Event(), slug: "lax001" }),
      });
      const service = buildService(eventRepo, mockRepo(), {
        db: mockSaleRepo({ id: "sale-1", title: "Onsite sale", deliveryMode: "onsite" }),
      });
      const result = await service.createAdminEvent(createBody("sale-1"));
      expect("code" in result && result.code).toBe("sale_already_linked");
    });

    it("createAdminEvent rejects a sale that is not onsite/hybrid", async () => {
      const eventRepo = mockEventRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
      const service = buildService(eventRepo, mockRepo(), {
        db: mockSaleRepo({ id: "sale-1", title: "Online sale", deliveryMode: "online" }),
      });
      const result = await service.createAdminEvent(createBody("sale-1"));
      expect("code" in result && result.code).toBe("sale_not_saleroom");
    });

    it("createAdminEvent rejects a missing sale", async () => {
      const eventRepo = mockEventRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
      const service = buildService(eventRepo, mockRepo(), { db: mockSaleRepo(null) });
      const result = await service.createAdminEvent(createBody("sale-missing"));
      expect("code" in result && result.code).toBe("sale_not_found");
    });

    it("createAdminEvent succeeds when the sale is unlinked and onsite/hybrid", async () => {
      const create = vi.fn().mockResolvedValue({ ...lax001Event(), slug: "lax002" });
      const eventRepo = mockEventRepo({ findBySlug: vi.fn().mockResolvedValue(null), create });
      const service = buildService(eventRepo, mockRepo(), {
        db: mockSaleRepo({ id: "sale-1", title: "Hybrid sale", deliveryMode: "hybrid" }),
      });
      const result = await service.createAdminEvent(createBody("sale-1"));
      expect("code" in result).toBe(false);
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ saleId: "sale-1" }));
    });

    it("updateAdminEvent allows an event to keep its own linked sale", async () => {
      const update = vi.fn().mockResolvedValue({ ...lax001Event(), saleId: "sale-1" });
      const eventRepo = mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue({ ...lax001Event(), saleId: "sale-1" }),
        findBySaleId: vi.fn().mockResolvedValue(lax001Event()),
        update,
      });
      const service = buildService(eventRepo, mockRepo(), {
        db: mockSaleRepo({ id: "sale-1", title: "Onsite sale", deliveryMode: "onsite" }),
      });
      const result = await service.updateAdminEvent("lax001", { saleId: "sale-1" });
      expect("code" in result).toBe(false);
      expect(update).toHaveBeenCalled();
    });

    it("updateAdminEvent rejects re-linking a sale claimed by a different event", async () => {
      const eventRepo = mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue(lax001Event()),
        findBySaleId: vi.fn().mockResolvedValue({ ...lax001Event(), slug: "lax002" }),
      });
      const service = buildService(eventRepo, mockRepo(), {
        db: mockSaleRepo({ id: "sale-1", title: "Onsite sale", deliveryMode: "onsite" }),
      });
      const result = await service.updateAdminEvent("lax001", { saleId: "sale-1" });
      expect("code" in result && result.code).toBe("sale_already_linked");
    });
  });
});
