import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptCheckInToken } from "../lib/check-in-token-ciphertext.js";
import { issueCheckInToken } from "../lib/onsite-event-check-in-token.js";
import type { IOnsiteEventClientReader } from "../repositories/interfaces/onsite-event-client.reader.js";
import type { IOnsiteEventRsvpRepository } from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import type { IOnsiteEventNotifier } from "./interfaces/onsite-event-notifier.js";
import { OnsiteEventRsvpService } from "./onsite-event-rsvp.service.js";

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
    listAdminItems: vi.fn().mockResolvedValue([]),
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

describe("OnsiteEventRsvpService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lookupByEmail returns not_registered for unknown email", async () => {
    const service = new OnsiteEventRsvpService(
      mockEventRepo(),
      mockRepo(),
      mockClientReader({ findByEmail: vi.fn().mockResolvedValue(null) }),
    );
    const result = await service.lookupByEmail("lax001", "new@example.com");
    expect(result).toEqual({ status: "not_registered" });
  });

  it("lookupByEmail returns ready with segment options", async () => {
    const service = new OnsiteEventRsvpService(mockEventRepo(), mockRepo(), mockClientReader());
    const result = await service.lookupByEmail("lax001", "guest@example.com");
    expect(result).toEqual({
      status: "ready",
      user: { name: "Guest User", email: "guest@example.com" },
      segmentOptions: lax001Event().segmentOptions,
    });
  });

  it("returns event_not_found for unknown slug", async () => {
    const service = new OnsiteEventRsvpService(
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

  it("upserts RSVP with guest name column", async () => {
    const upsert = vi.fn().mockResolvedValue({
      ...baseRsvp(),
      plusOne: 1,
      plusOneGuestName: "Jane Doe",
    });
    const service = new OnsiteEventRsvpService(
      mockEventRepo(),
      mockRepo({ upsert }),
      mockClientReader(),
      null,
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
    const service = new OnsiteEventRsvpService(
      mockEventRepo(),
      mockRepo({
        findByEventAndUser: vi.fn().mockResolvedValue(existing),
        upsert,
      }),
      mockClientReader(),
      null,
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

  it("resendPass sends email before persisting a new token", async () => {
    let emailDelivered = false;
    const updateCheckInToken = vi.fn().mockImplementation(async () => {
      expect(emailDelivered).toBe(true);
      return baseRsvp();
    });
    const notifyResent = vi.fn().mockImplementation(async () => {
      emailDelivered = true;
    });
    const notifier: IOnsiteEventNotifier = {
      notifyResent,
      notifySubmitted: vi.fn(),
      notifyUpdated: vi.fn(),
    };
    const service = new OnsiteEventRsvpService(
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
      mockClientReader(),
      notifier,
      TEST_CIPHER_SECRET,
    );

    const result = await service.resendPass("lax001", "rsvp-1");

    expect(result).toEqual({ ok: true, rotated: true, emailSent: true });
    expect(notifyResent).toHaveBeenCalledTimes(1);
    expect(updateCheckInToken).toHaveBeenCalledTimes(1);
  });

  it("resendPass does not rotate token when email delivery fails", async () => {
    const updateCheckInToken = vi.fn();
    const notifier: IOnsiteEventNotifier = {
      notifyResent: vi.fn().mockRejectedValue(new Error("smtp down")),
      notifySubmitted: vi.fn(),
      notifyUpdated: vi.fn(),
    };
    const service = new OnsiteEventRsvpService(
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
      mockClientReader(),
      notifier,
      TEST_CIPHER_SECRET,
    );

    const result = await service.resendPass("lax001", "rsvp-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("pass_email_failed");
    }
    expect(updateCheckInToken).not.toHaveBeenCalled();
  });

  it("resendPass fails when notifier is not configured", async () => {
    const service = new OnsiteEventRsvpService(
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
      mockClientReader(),
      null,
      TEST_CIPHER_SECRET,
    );

    const result = await service.resendPass("lax001", "rsvp-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("pass_email_not_configured");
    }
  });

  it("exports admin csv", async () => {
    const service = new OnsiteEventRsvpService(
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
      mockClientReader(),
    );
    const csv = await service.exportAdminCsv("lax001");
    expect(typeof csv).toBe("string");
    expect(csv).toContain("guest@example.com");
  });
});
