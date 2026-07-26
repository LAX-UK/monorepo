import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminEventRsvpDetailPage } from "./load-event-rsvp-detail-page";

const { getDetail, getRsvps, getGuests } = vi.hoisted(() => ({
  getDetail: vi.fn(),
  getRsvps: vi.fn(),
  getGuests: vi.fn(),
}));

vi.mock("@/lib/data/http/onsite-event.server", () => ({
  getAdminOnsiteEventDetail: getDetail,
  getAdminOnsiteEventRsvps: getRsvps,
}));

vi.mock("@/lib/data/http/admin-expected-guests.server", () => ({
  getAdminExpectedGuests: getGuests,
}));

describe("loadAdminEventRsvpDetailPage", () => {
  beforeEach(() => {
    getDetail.mockResolvedValue({
      title: "Preview Night",
      segmentOptions: [],
      micrositeUrl: null,
      saleId: "sale-1",
    });
    getRsvps.mockResolvedValue([{ id: "rsvp-1" }]);
    getGuests.mockResolvedValue({
      counts: { rsvped: 1, galaCheckedIn: 0, salePresent: 0, paddled: 0 },
    });
  });

  it("loads detail, RSVPs, and linked sale counts", async () => {
    const model = await loadAdminEventRsvpDetailPage({ slug: "preview-night" });
    expect(model.notFound).toBe(false);
    expect(model.detail?.title).toBe("Preview Night");
    expect(model.rsvps).toHaveLength(1);
    expect(model.venueDayCounts?.rsvped).toBe(1);
    expect(model.loadError).toBeNull();
  });

  it("returns notFound when event is missing", async () => {
    getDetail.mockResolvedValue(null);
    const model = await loadAdminEventRsvpDetailPage({ slug: "missing" });
    expect(model.notFound).toBe(true);
    expect(model.detail).toBeNull();
  });
});
