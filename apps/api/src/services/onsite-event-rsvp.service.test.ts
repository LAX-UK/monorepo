import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IOnsiteEventClientReader } from "../repositories/interfaces/onsite-event-client.reader.js";
import type { IOnsiteEventRsvpRepository } from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import { OnsiteEventRsvpService } from "./onsite-event-rsvp.service.js";

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
  status: "published",
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
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
  updatedAt: new Date("2026-06-01T12:00:00.000Z"),
});

function mockEventRepo(overrides: Partial<IOnsiteEventRepository> = {}): IOnsiteEventRepository {
  return {
    findBySlug: vi.fn().mockResolvedValue(lax001Event()),
    listAdminItems: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mockRepo(overrides: Partial<IOnsiteEventRsvpRepository> = {}): IOnsiteEventRsvpRepository {
  return {
    findByEventAndUser: vi.fn().mockResolvedValue(null),
    listAdminRows: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(baseRsvp()),
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
    );
    const result = await service.submitRsvp("lax001", {
      email: "guest@example.com",
      attendanceSegment: "auction_only",
      plusOne: 1,
      plusOneGuestName: "Jane Doe",
    });
    expect(result.ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith({
      eventSlug: "lax001",
      userId: "user-1",
      attendanceSegment: "auction_only",
      plusOne: 1,
      plusOneGuestName: "Jane Doe",
      notes: null,
    });
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
