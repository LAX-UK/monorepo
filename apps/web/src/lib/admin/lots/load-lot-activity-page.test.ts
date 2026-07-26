import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminLotActivityPage } from "./load-lot-activity-page";

const { getEvents } = vi.hoisted(() => ({
  getEvents: vi.fn(),
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminDomainEventsForAggregate: getEvents,
}));

describe("loadAdminLotActivityPage", () => {
  beforeEach(() => {
    getEvents.mockReset();
    getEvents.mockResolvedValue([{ id: "evt_1" }]);
  });

  it("loads lot activity events with a bounded limit", async () => {
    const result = await loadAdminLotActivityPage("lot_1");

    expect(result.lotId).toBe("lot_1");
    expect(result.events).toEqual([{ id: "evt_1" }]);
    expect(getEvents).toHaveBeenCalledWith({
      aggregateType: "lot",
      aggregateId: "lot_1",
      limit: 50,
    });
  });

  it("returns an empty list when the activity fetch fails", async () => {
    getEvents.mockRejectedValue(new Error("network"));

    const result = await loadAdminLotActivityPage("lot_2");

    expect(result.events).toEqual([]);
  });
});
