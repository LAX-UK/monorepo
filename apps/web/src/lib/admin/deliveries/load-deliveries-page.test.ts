import { beforeEach, describe, expect, it, vi } from "vitest";
import { ON_THE_WAY, deliveriesPageFixture } from "./deliveries.fixture";

vi.mock("server-only", () => ({}));
const reader = vi.hoisted(() => ({ getAdminDeliveries: vi.fn(), getAdminDelivery: vi.fn() }));
vi.mock("@/lib/data/http/admin-deliveries.reader", () => reader);

import { loadAdminDeliveriesPage } from "./load-deliveries-page";

const SALE = "5a1e0000-0000-4000-8000-000000000001";

beforeEach(() => {
  reader.getAdminDeliveries.mockReset();
  reader.getAdminDelivery.mockReset();
});

describe("loadAdminDeliveriesPage", () => {
  it("reads the view in the URL with its search and sale, and names the sale's chip", async () => {
    reader.getAdminDeliveries.mockResolvedValue(deliveriesPageFixture());
    const model = await loadAdminDeliveriesPage({ view: "quoted", q: "Cork", sale: SALE });
    const query = reader.getAdminDeliveries.mock.calls[0]?.[0] as URLSearchParams;
    expect(Object.fromEntries(query)).toMatchObject({ view: "quoted", q: "Cork", saleId: SALE });
    expect(model).toMatchObject({
      filtered: true,
      loadError: null,
      selected: null,
      pagination: null,
      chips: [{ id: "sale", label: "Sale: Modern British" }],
    });
    expect(reader.getAdminDelivery).not.toHaveBeenCalled();
  });

  it("loads the lot in the URL when it is not on this page of the view", async () => {
    reader.getAdminDeliveries.mockResolvedValue(deliveriesPageFixture({ items: [] }));
    reader.getAdminDelivery.mockResolvedValue(ON_THE_WAY);
    const model = await loadAdminDeliveriesPage({ record: ON_THE_WAY.lotId });
    expect(reader.getAdminDelivery).toHaveBeenCalledWith(ON_THE_WAY.lotId);
    expect(model.selected).toEqual(ON_THE_WAY);
  });

  it("does not ask again for a lot already listed", async () => {
    const page = deliveriesPageFixture();
    reader.getAdminDeliveries.mockResolvedValue(page);
    await loadAdminDeliveriesPage({ record: page.items[0]?.lotId });
    expect(reader.getAdminDelivery).not.toHaveBeenCalled();
  });

  it("turns an API that does not answer into the error state", async () => {
    reader.getAdminDeliveries.mockRejectedValue(new Error("Deliveries unavailable: 503"));
    const model = await loadAdminDeliveriesPage({});
    expect(model).toMatchObject({
      page: null,
      loadError: "The Bid API didn't answer. Buyers' requests are kept; try again in a moment.",
    });
  });

  it("says so when access is refused", async () => {
    reader.getAdminDeliveries.mockRejectedValue(new Error("forbidden"));
    expect((await loadAdminDeliveriesPage({})).loadError).toBe(
      "You do not have access to deliveries.",
    );
  });
});
