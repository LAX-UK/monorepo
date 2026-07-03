import type { IGuestPaddleReader } from "@auction/persistence";
import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueCheckInToken } from "../lib/onsite-event-check-in-token.js";
import type { IOnsiteEventRsvpRepository } from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import { OnsiteEventPassService } from "./onsite-event-pass.service.js";
import { PassQrRenderService } from "./pass-qr-render.service.js";

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

function guestRsvp(token: ReturnType<typeof issueCheckInToken>) {
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

describe("OnsiteEventPassService", () => {
  const token = issueCheckInToken();
  let rsvp = guestRsvp(token);

  beforeEach(() => {
    vi.clearAllMocks();
    rsvp = guestRsvp(token);
  });

  it("returns pass view for valid token", async () => {
    const rsvpRepo = mockRsvpRepo({
      findByTokenHash: vi.fn().mockResolvedValue(rsvp),
    });
    const service = new OnsiteEventPassService(
      mockEventRepo(),
      rsvpRepo,
      new PassQrRenderService(),
    );
    const pass = await service.getPassView("lax001", token.plainToken, "https://api.lax.bid");
    expect("slug" in pass && pass.slug).toBe("lax001");
    if ("guestName" in pass) {
      expect(pass.guestName).toBe("Guest User");
      expect(pass.partySize).toBe(2);
      expect(pass.paddleNumber).toBeNull();
    }
  });

  it("returns paddleNumber when linked sale has assigned paddle", async () => {
    const guestPaddleReader: IGuestPaddleReader = {
      findCheckedInPaddle: vi.fn().mockResolvedValue(142),
    };
    const rsvpRepo = mockRsvpRepo({
      findByTokenHash: vi.fn().mockResolvedValue(rsvp),
    });
    const service = new OnsiteEventPassService(
      mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue({ ...lax001Event(), saleId: "sale-1" }),
      }),
      rsvpRepo,
      new PassQrRenderService(),
      guestPaddleReader,
    );
    const pass = await service.getPassView("lax001", token.plainToken, "https://api.lax.bid");
    expect("paddleNumber" in pass && pass.paddleNumber).toBe(142);
  });

  it("returns null paddleNumber when guest has no registration paddle", async () => {
    const guestPaddleReader: IGuestPaddleReader = {
      findCheckedInPaddle: vi.fn().mockResolvedValue(null),
    };
    const rsvpRepo = mockRsvpRepo({
      findByTokenHash: vi.fn().mockResolvedValue(rsvp),
    });
    const service = new OnsiteEventPassService(
      mockEventRepo({
        findBySlug: vi.fn().mockResolvedValue({ ...lax001Event(), saleId: "sale-1" }),
      }),
      rsvpRepo,
      new PassQrRenderService(),
      guestPaddleReader,
    );
    const pass = await service.getPassView("lax001", token.plainToken, "https://api.lax.bid");
    expect("paddleNumber" in pass && pass.paddleNumber).toBeNull();
  });

  it("getPassViewByToken resolves slug from RSVP token", async () => {
    const rsvpRepo = mockRsvpRepo({
      findByTokenHash: vi.fn().mockResolvedValue(rsvp),
    });
    const service = new OnsiteEventPassService(
      mockEventRepo(),
      rsvpRepo,
      new PassQrRenderService(),
    );
    const pass = await service.getPassViewByToken(token.plainToken, "https://api.lax.bid");
    expect("slug" in pass && pass.slug).toBe("lax001");
  });

  it("returns not found for token after rotation", async () => {
    const oldToken = issueCheckInToken();
    const rsvpRepo = mockRsvpRepo({
      findByTokenHash: vi.fn().mockResolvedValue(null),
    });
    const service = new OnsiteEventPassService(
      mockEventRepo(),
      rsvpRepo,
      new PassQrRenderService(),
    );
    const pass = await service.getPassView("lax001", oldToken.plainToken, "https://api.lax.bid");
    expect("status" in pass && pass.status).toBe(404);
  });
});
