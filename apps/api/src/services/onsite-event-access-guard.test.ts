import type { IOnsiteEventRepository } from "@auction/persistence/interfaces";
import type { OnsiteEvent } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { OnsiteEventAccessGuard } from "./onsite-event-access-guard.js";

const baseEvent = (overrides: Partial<OnsiteEvent> = {}): OnsiteEvent => ({
  slug: "lax001",
  title: "LAX 001: The First Hammer",
  startsAt: null,
  rsvpCloseAt: null,
  segmentOptions: [],
  opsEmail: null,
  micrositeUrl: null,
  venue: null,
  dressCode: null,
  arrivalNote: null,
  status: "published",
  checkInDryRun: false,
  saleId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

function mockEventRepo(findBySlug: IOnsiteEventRepository["findBySlug"]): IOnsiteEventRepository {
  return {
    findBySlug,
    findBySaleId: vi.fn().mockResolvedValue(null),
    listAdminItems: vi.fn().mockResolvedValue([]),
    listPublicUpcoming: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    updateCheckInDryRun: vi.fn(),
  };
}

describe("OnsiteEventAccessGuard", () => {
  it("requirePublicEvent hides drafts as not found", async () => {
    const guard = new OnsiteEventAccessGuard(
      mockEventRepo(vi.fn().mockResolvedValue(baseEvent({ status: "draft" }))),
    );
    const result = await guard.requirePublicEvent("lax001");
    expect(result).toEqual({ message: "Event not found", status: 404, code: "event_not_found" });
  });

  it("requirePublicEvent allows published and closed events", async () => {
    for (const status of ["published", "closed"] as const) {
      const guard = new OnsiteEventAccessGuard(
        mockEventRepo(vi.fn().mockResolvedValue(baseEvent({ status }))),
      );
      const result = await guard.requirePublicEvent("lax001");
      expect("status" in result && typeof result.status === "string").toBe(true);
    }
  });

  it("requirePublishedEvent rejects closed events as not found", async () => {
    const guard = new OnsiteEventAccessGuard(
      mockEventRepo(vi.fn().mockResolvedValue(baseEvent({ status: "closed" }))),
    );
    const result = await guard.requirePublishedEvent("lax001");
    expect(result).toEqual({ message: "Event not found", status: 404, code: "event_not_found" });
  });

  it("requireAdminEvent allows drafts", async () => {
    const guard = new OnsiteEventAccessGuard(
      mockEventRepo(vi.fn().mockResolvedValue(baseEvent({ status: "draft" }))),
    );
    const result = await guard.requireAdminEvent("lax001");
    expect("status" in result && typeof result.status === "string").toBe(true);
  });

  it("requireAdminEvent returns not found for missing slug", async () => {
    const guard = new OnsiteEventAccessGuard(mockEventRepo(vi.fn().mockResolvedValue(null)));
    const result = await guard.requireAdminEvent("missing");
    expect(result).toEqual({ message: "Event not found", status: 404, code: "event_not_found" });
  });

  it("isEventClosed is true once status is closed", () => {
    const guard = new OnsiteEventAccessGuard(mockEventRepo(vi.fn()));
    expect(guard.isEventClosed(baseEvent({ status: "closed" }))).toBe(true);
  });

  it("isEventClosed is true once the rsvp deadline has passed", () => {
    const guard = new OnsiteEventAccessGuard(mockEventRepo(vi.fn()));
    expect(
      guard.isEventClosed(baseEvent({ rsvpCloseAt: new Date("2020-01-01T00:00:00.000Z") })),
    ).toBe(true);
  });

  it("isEventClosed is false when published with no or future deadline", () => {
    const guard = new OnsiteEventAccessGuard(mockEventRepo(vi.fn()));
    expect(guard.isEventClosed(baseEvent())).toBe(false);
    expect(
      guard.isEventClosed(baseEvent({ rsvpCloseAt: new Date("2099-01-01T00:00:00.000Z") })),
    ).toBe(false);
  });
});
