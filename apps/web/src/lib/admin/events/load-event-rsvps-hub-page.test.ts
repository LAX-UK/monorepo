import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminEventRsvpsHubPage } from "./load-event-rsvps-hub-page";

const { getEvents } = vi.hoisted(() => ({
  getEvents: vi.fn(),
}));

vi.mock("@/lib/data/http/onsite-event.server", () => ({
  getAdminOnsiteEvents: getEvents,
}));

describe("loadAdminEventRsvpsHubPage", () => {
  beforeEach(() => {
    getEvents.mockResolvedValue([
      { slug: "preview", title: "Preview", status: "published", rsvpCount: 3, startsAt: null },
      { slug: "draft", title: "Draft", status: "draft", rsvpCount: 0, startsAt: null },
    ]);
  });

  it("aggregates RSVP counts", async () => {
    const result = await loadAdminEventRsvpsHubPage();
    expect(result.events).toHaveLength(2);
    expect(result.totalRsvps).toBe(3);
    expect(result.publishedCount).toBe(1);
    expect(result.loadError).toBeNull();
  });
});
