import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminVenueEditPage } from "./load-venue-edit-page";

const { loadVenue } = vi.hoisted(() => ({
  loadVenue: vi.fn(),
}));

vi.mock("@/lib/admin/load-venue-detail", () => ({
  loadAdminVenueDetail: loadVenue,
}));

describe("loadAdminVenueEditPage", () => {
  beforeEach(() => {
    loadVenue.mockResolvedValue({
      venue: { id: "ven-1", name: "Main gallery", status: "active" },
      salesUsingCount: 2,
      legalEntityDisplayName: "LAX Ltd",
    });
  });

  it("loads venue edit bundle", async () => {
    const model = await loadAdminVenueEditPage("ven-1");
    expect(model.venue.name).toBe("Main gallery");
    expect(model.salesUsingCount).toBe(2);
    expect(model.detailHref).toBe("/admin/venues/ven-1");
  });
});
