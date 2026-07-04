import type { IOnsiteEventClientReader } from "@auction/persistence";
import type { IOnsiteEventRsvpRepository } from "@auction/persistence";
import type { IOnsiteEventRepository } from "@auction/persistence";
import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptCheckInToken } from "../lib/check-in-token-ciphertext.js";
import { issueCheckInToken } from "../lib/onsite-event-check-in-token.js";
import { OnsiteEventPassTokenService } from "./onsite-event-pass-token.service.js";
import { OnsiteEventPublicRsvpService } from "./onsite-event-public-rsvp.service.js";
import { OnsiteEventSaleLinkService } from "./onsite-event-sale-link.service.js";

const TEST_CIPHER_SECRET = "test-secret-with-enough-length-for-scrypt";

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

function mockClientReader(
  overrides: Partial<IOnsiteEventClientReader> = {},
): IOnsiteEventClientReader {
  return {
    findByEmail: vi.fn().mockResolvedValue({
      id: "user-1",
      email: "guest@example.com",
      name: "Guest User",
      suspended: false,
    }),
    ...overrides,
  };
}

/** No test here exercises cross-domain sale lookups, so a db-less sale-link service is enough. */
function saleLinkService(eventRepo: IOnsiteEventRepository = mockEventRepo()) {
  return new OnsiteEventSaleLinkService(eventRepo, null);
}

function tokenService(secret: string | null = null) {
  return new OnsiteEventPassTokenService(secret);
}

function buildService(
  eventRepo: IOnsiteEventRepository,
  rsvpRepo: IOnsiteEventRsvpRepository,
  clientReader: IOnsiteEventClientReader,
  cipherSecret: string | null = null,
) {
  return new OnsiteEventPublicRsvpService(
    eventRepo,
    rsvpRepo,
    clientReader,
    saleLinkService(eventRepo),
    tokenService(cipherSecret),
  );
}

describe("OnsiteEventPublicRsvpService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lookupByEmail returns not_registered for unknown email", async () => {
    const service = buildService(
      mockEventRepo(),
      mockRepo(),
      mockClientReader({ findByEmail: vi.fn().mockResolvedValue(null) }),
    );
    const result = await service.lookupByEmail("lax001", "new@example.com");
    expect(result).toEqual({ status: "not_registered" });
  });

  it("lookupByEmail returns ready with segment options", async () => {
    const service = buildService(mockEventRepo(), mockRepo(), mockClientReader());
    const result = await service.lookupByEmail("lax001", "guest@example.com");
    expect(result).toEqual({
      status: "ready",
      user: { name: "Guest User", email: "guest@example.com" },
      segmentOptions: lax001Event().segmentOptions,
    });
  });

  it("returns event_not_found for unknown slug", async () => {
    const service = buildService(
      mockEventRepo({ findBySlug: vi.fn().mockResolvedValue(null) }),
      mockRepo(),
      mockClientReader(),
    );
    const result = await service.lookupByEmail("missing", "guest@example.com");
    expect(result).toEqual({
      message: "Event not found",
      status: 404,
      code: "event_not_found",
    });
  });

  it("listUpcomingPublicEvents returns published upcoming rows from the repository", async () => {
    const upcoming = [
      {
        slug: "lax002",
        title: "Summer evening",
        startsAt: "2026-08-14T17:00:00.000Z",
        venue: "Royal Academy",
        dressCode: "Smart formal",
        micrositeUrl: "https://event.lax.bid/lax002",
        deliveryMode: "hybrid" as const,
      },
    ];
    const service = buildService(
      mockEventRepo({ listPublicUpcoming: vi.fn().mockResolvedValue(upcoming) }),
      mockRepo(),
      mockClientReader(),
    );

    await expect(service.listUpcomingPublicEvents()).resolves.toEqual(upcoming);
  });

  it("upserts RSVP with guest name column", async () => {
    const upsert = vi.fn().mockResolvedValue({
      ...baseRsvp(),
      plusOne: 1,
      plusOneGuestName: "Jane Doe",
    });
    const service = buildService(
      mockEventRepo(),
      mockRepo({ upsert }),
      mockClientReader(),
      TEST_CIPHER_SECRET,
    );
    const result = await service.submitRsvp("lax001", {
      email: "guest@example.com",
      attendanceSegment: "auction_only",
      plusOne: 1,
      plusOneGuestName: "Jane Doe",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.passUrl).toContain("/pass/");
    }
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventSlug: "lax001",
        userId: "user-1",
        attendanceSegment: "auction_only",
        plusOne: 1,
        plusOneGuestName: "Jane Doe",
        notes: null,
        checkInTokenHash: expect.any(String),
        checkInTokenIssuedAt: expect.any(Date),
        checkInTokenCiphertext: expect.stringMatching(/^v1:/),
      }),
    );
  });

  it("preserves existing pass token on RSVP update", async () => {
    const issued = issueCheckInToken();
    const ciphertext = encryptCheckInToken(issued.plainToken, TEST_CIPHER_SECRET);
    const existing = {
      ...baseRsvp(),
      checkInTokenHash: issued.tokenHash,
      checkInTokenIssuedAt: new Date("2026-06-01T12:00:00.000Z"),
      checkInTokenCiphertext: ciphertext,
    };
    const upsert = vi.fn().mockResolvedValue(existing);
    const service = buildService(
      mockEventRepo(),
      mockRepo({
        findByEventAndUser: vi.fn().mockResolvedValue(existing),
        upsert,
      }),
      mockClientReader(),
      TEST_CIPHER_SECRET,
    );
    const result = await service.submitRsvp("lax001", {
      email: "guest@example.com",
      attendanceSegment: "gala_only",
      plusOne: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isUpdate).toBe(true);
      expect(result.passUrl).toContain(issued.plainToken);
    }
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        checkInTokenHash: issued.tokenHash,
        checkInTokenCiphertext: ciphertext,
      }),
    );
  });

  it("lookupByEmail returns event_closed after rsvp deadline", async () => {
    const service = buildService(
      mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue({
          ...lax001Event(),
          rsvpCloseAt: new Date("2020-01-01T00:00:00.000Z"),
        }),
      }),
      mockRepo(),
      mockClientReader(),
    );
    const result = await service.lookupByEmail("lax001", "guest@example.com");
    expect(result).toEqual({ status: "event_closed" });
  });

  it("getPublicConfig returns archived read-only config for closed events", async () => {
    const service = buildService(
      mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue({ ...lax001Event(), status: "closed" }),
      }),
      mockRepo(),
      mockClientReader(),
    );
    const result = await service.getPublicConfig("lax001");
    expect(result).toMatchObject({
      slug: "lax001",
      title: lax001Event().title,
      rsvpOpen: false,
      status: "closed",
      opsEmail: "events@lax.bid",
    });
  });

  it("getPublicConfig returns not found for draft events", async () => {
    const service = buildService(
      mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue({ ...lax001Event(), status: "draft" }),
      }),
      mockRepo(),
      mockClientReader(),
    );
    const result = await service.getPublicConfig("lax001");
    expect(result).toEqual({
      message: "Event not found",
      status: 404,
      code: "event_not_found",
    });
  });

  it("lookupByEmail returns not found for closed events", async () => {
    const service = buildService(
      mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue({ ...lax001Event(), status: "closed" }),
      }),
      mockRepo(),
      mockClientReader(),
    );
    const result = await service.lookupByEmail("lax001", "guest@example.com");
    expect(result).toEqual({
      message: "Event not found",
      status: 404,
      code: "event_not_found",
    });
  });

  it("lookupByEmail returns suspended for suspended client", async () => {
    const service = buildService(
      mockEventRepo(),
      mockRepo(),
      mockClientReader({
        findByEmail: vi.fn().mockResolvedValue({
          id: "user-1",
          email: "guest@example.com",
          name: "Guest User",
          suspended: true,
        }),
      }),
    );
    const result = await service.lookupByEmail("lax001", "guest@example.com");
    expect(result).toEqual({ status: "suspended" });
  });

  it("submitRsvp rejects invalid attendance segment", async () => {
    const service = buildService(
      mockEventRepo(),
      mockRepo(),
      mockClientReader(),
      TEST_CIPHER_SECRET,
    );
    const result = await service.submitRsvp("lax001", {
      email: "guest@example.com",
      attendanceSegment: "invalid_segment",
      plusOne: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_segment");
    }
  });
});
