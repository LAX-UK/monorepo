import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminEventRsvpEditPage } from "./load-event-rsvp-edit-page";

const { getDetail, loadPicker } = vi.hoisted(() => ({
  getDetail: vi.fn(),
  loadPicker: vi.fn(),
}));

vi.mock("@/lib/data/http/onsite-event.server", () => ({
  getAdminOnsiteEventDetail: getDetail,
}));

vi.mock("@/lib/admin/load-saleroom-sales-picker", () => ({
  loadSaleroomSalesForPicker: loadPicker,
}));

describe("loadAdminEventRsvpEditPage", () => {
  beforeEach(() => {
    getDetail.mockResolvedValue({ title: "Preview Night", segmentOptions: [] });
    loadPicker.mockResolvedValue([{ id: "sale-1", title: "Hybrid sale" }]);
  });

  it("loads edit bundle", async () => {
    const model = await loadAdminEventRsvpEditPage({ slug: "preview-night" });
    expect(model.notFound).toBe(false);
    expect(model.detail?.title).toBe("Preview Night");
    expect(model.saleroomSales).toHaveLength(1);
  });

  it("returns notFound when event is missing", async () => {
    getDetail.mockResolvedValue(null);
    const model = await loadAdminEventRsvpEditPage({ slug: "missing" });
    expect(model.notFound).toBe(true);
  });
});
