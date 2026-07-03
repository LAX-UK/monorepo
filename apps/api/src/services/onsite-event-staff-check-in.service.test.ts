import type { IOnsiteEventCheckInLogRepository } from "@auction/persistence";
import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashCheckInToken, issueCheckInToken } from "../lib/onsite-event-check-in-token.js";
import type {
  IOnsiteEventRsvpRepository,
  OnsiteEventRsvpWithGuest,
} from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import { OnsiteEventStaffCheckInService } from "./onsite-event-staff-check-in.service.js";

const lax001Event = (): OnsiteEvent => ({
  slug: "lax001",
  title: "LAX 001: The First Hammer",
  startsAt: new Date("2026-06-18T18:00:00.000Z"),
  rsvpCloseAt: new Date("2099-01-01T00:00:00.000Z"),
  segmentOptions: [{ value: "full_evening", label: "Full evening" }],
  opsEmail: "events@lax.bid",
  micrositeUrl: "https://event.lax.bid",
  venue: "Brunswick Art Gallery & Centre, London",
  dressCode: "Smart formal",
  arrivalNote: "Doors 6:00 PM · Personal and non-transferable.",
  status: "published",
  checkInDryRun: false,
  saleId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

function guestRsvp(token: ReturnType<typeof issueCheckInToken>): OnsiteEventRsvpWithGuest {
  const base: OnsiteEventRsvp = {
    id: "rsvp-1",
    eventSlug: "lax001",
    userId: "user-1",
    attendanceSegment: "full_evening",
    plusOne: 1,
    plusOneGuestName: "Alex Guest",
    notes: null,
    checkInTokenHash: token.tokenHash,
    checkInTokenIssuedAt: new Date("2026-06-01T12:00:00.000Z"),
    checkInTokenCiphertext: null,
    checkedInAt: null,
    checkedInByUserId: null,
    checkInPartyCount: null,
    createdAt: new Date("2026-06-01T12:00:00.000Z"),
    updatedAt: new Date("2026-06-01T12:00:00.000Z"),
  };
  return {
    ...base,
    guestName: "Guest User",
    guestEmail: "guest@example.com",
    checkedInByName: null,
  };
}

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

function mockRsvpRepo(
  overrides: Partial<IOnsiteEventRsvpRepository> = {},
): IOnsiteEventRsvpRepository {
  return {
    findByEventAndUser: vi.fn(),
    findByIdWithGuest: vi.fn(),
    findByTokenHash: vi.fn(),
    listAdminRows: vi.fn(),
    upsert: vi.fn(),
    updateCheckInToken: vi.fn(),
    issueTokenIfMissing: vi.fn(),
    atomicCheckIn: vi.fn(),
    searchForCheckIn: vi.fn(),
    countCheckInStats: vi.fn(),
    ...overrides,
  };
}

function mockLogRepo(): IOnsiteEventCheckInLogRepository {
  return { insert: vi.fn().mockResolvedValue(undefined) };
}

describe("OnsiteEventStaffCheckInService", () => {
  const token = issueCheckInToken();
  let rsvp = guestRsvp(token);

  beforeEach(() => {
    vi.clearAllMocks();
    rsvp = guestRsvp(token);
  });

  it("checks in once then reports already checked in", async () => {
    const checkedIn = {
      ...rsvp,
      checkedInAt: new Date("2026-06-18T18:05:00.000Z"),
      checkedInByUserId: "staff-1",
      checkedInByName: "Staff User",
      checkInPartyCount: 2,
    };
    const findByTokenHash = vi.fn().mockResolvedValueOnce(rsvp).mockResolvedValueOnce(checkedIn);
    const atomicCheckIn = vi.fn().mockResolvedValue(checkedIn);
    const rsvpRepo = mockRsvpRepo({
      findByIdWithGuest: vi.fn().mockResolvedValue(checkedIn),
      findByTokenHash,
      atomicCheckIn,
    });
    const service = new OnsiteEventStaffCheckInService(mockEventRepo(), rsvpRepo, mockLogRepo());

    const first = await service.checkIn("lax001", { token: token.plainToken }, "staff-1");
    expect(first.status).toBe("VALID");

    const second = await service.checkIn("lax001", { token: token.plainToken }, "staff-1");
    expect(second.status).toBe("ALREADY_CHECKED_IN");
    expect(atomicCheckIn).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid token", async () => {
    const rsvpRepo = mockRsvpRepo({
      findByTokenHash: vi.fn().mockResolvedValue(null),
    });
    const service = new OnsiteEventStaffCheckInService(mockEventRepo(), rsvpRepo, mockLogRepo());
    const result = await service.checkIn("lax001", { token: "bad-token-value" }, "staff-1");
    expect(result.status).toBe("INVALID");
  });

  it("normalises URL scans", async () => {
    const atomicCheckIn = vi.fn().mockResolvedValue({
      ...rsvp,
      checkedInAt: new Date(),
      checkedInByUserId: "staff-1",
      checkedInByName: "Staff",
      checkInPartyCount: 2,
    });
    const rsvpRepo = mockRsvpRepo({
      findByTokenHash: vi
        .fn()
        .mockImplementation(async (hash: string) => (hash === token.tokenHash ? rsvp : null)),
      atomicCheckIn,
    });
    const service = new OnsiteEventStaffCheckInService(mockEventRepo(), rsvpRepo, mockLogRepo());
    const result = await service.checkIn(
      "lax001",
      { token: `https://event.lax.bid/pass/${token.plainToken}` },
      "staff-1",
    );
    expect(result.status).toBe("VALID");
    expect(hashCheckInToken(token.plainToken)).toBe(token.tokenHash);
  });

  it("returns DRY_RUN_VALID without persisting check-in when dry-run is enabled", async () => {
    const atomicCheckIn = vi.fn();
    const logRepo = mockLogRepo();
    const rsvpRepo = mockRsvpRepo({
      findByTokenHash: vi.fn().mockResolvedValue(rsvp),
      atomicCheckIn,
    });
    const service = new OnsiteEventStaffCheckInService(
      mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue({ ...lax001Event(), checkInDryRun: true }),
      }),
      rsvpRepo,
      logRepo,
    );

    const result = await service.checkIn("lax001", { token: token.plainToken }, "staff-1");
    expect(result.status).toBe("DRY_RUN_VALID");
    expect(atomicCheckIn).not.toHaveBeenCalled();
    expect(logRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ result: "DRY_RUN_VALID" }),
    );
  });
});
