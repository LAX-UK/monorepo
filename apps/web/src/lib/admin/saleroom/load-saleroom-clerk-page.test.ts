import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSaleroomClerkPage } from "./load-saleroom-clerk-page";

const { getSale, getSession, getTelephone, getRoster } = vi.hoisted(() => ({
  getSale: vi.fn(),
  getSession: vi.fn(),
  getTelephone: vi.fn(),
  getRoster: vi.fn(),
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminSaleById: getSale,
}));

vi.mock("@/lib/data/http/admin-saleroom.reader", () => ({
  getAdminSaleroomSession: getSession,
  getAdminSalePaddleRoster: getRoster,
}));

vi.mock("@/lib/data/http/admin-telephone.server", () => ({
  getAdminTelephoneBookings: getTelephone,
}));

describe("loadSaleroomClerkPage", () => {
  beforeEach(() => {
    getSale.mockResolvedValue({
      sale: { title: "Hybrid A", deliveryMode: "hybrid", status: "active" },
      lots: [{ id: "lot-1" }],
    });
    getSession.mockResolvedValue({ session: { status: "live" }, events: [] });
    getTelephone.mockResolvedValue([]);
    getRoster.mockResolvedValue([{ paddleNumber: 1 }]);
  });

  it("loads clerk console bundle", async () => {
    const model = await loadSaleroomClerkPage({ saleId: "sale-1" });
    expect(model.notFound).toBe(false);
    expect(model.saleTitle).toBe("Hybrid A");
    expect(model.saleroom.session?.status).toBe("live");
    expect(model.paddleRoster).toHaveLength(1);
    expect(model.saleroomLoadError).toBeNull();
  });

  it("returns notFound when sale is missing", async () => {
    getSale.mockResolvedValue(null);
    const model = await loadSaleroomClerkPage({ saleId: "missing" });
    expect(model.notFound).toBe(true);
  });

  it("captures saleroom session errors without throwing", async () => {
    getSession.mockRejectedValue(new Error("socket offline"));
    const model = await loadSaleroomClerkPage({ saleId: "sale-1" });
    expect(model.saleroomLoadError).toBe("socket offline");
    expect(model.saleroom.session).toBeNull();
  });
});
