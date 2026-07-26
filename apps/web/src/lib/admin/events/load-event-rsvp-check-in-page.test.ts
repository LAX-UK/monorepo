import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminEventRsvpCheckInPage } from "./load-event-rsvp-check-in-page";

const { getDetail } = vi.hoisted(() => ({
  getDetail: vi.fn(),
}));

vi.mock("@/lib/data/http/onsite-event.server", () => ({
  getAdminOnsiteEventDetail: getDetail,
}));

describe("loadAdminEventRsvpCheckInPage", () => {
  beforeEach(() => {
    getDetail.mockResolvedValue({ title: "Preview Night" });
  });

  it("loads check-in title", async () => {
    const model = await loadAdminEventRsvpCheckInPage({ slug: "preview-night" });
    expect(model.notFound).toBe(false);
    expect(model.title).toBe("Preview Night");
  });

  it("returns notFound when event is missing", async () => {
    getDetail.mockResolvedValue(null);
    const model = await loadAdminEventRsvpCheckInPage({ slug: "missing" });
    expect(model.notFound).toBe(true);
  });
});
