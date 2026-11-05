import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadStaffProducts } = vi.hoisted(() => ({ loadStaffProducts: vi.fn() }));
vi.mock("./load-staff-products", () => ({ loadStaffProducts }));

const { loadBidAdminUrl } = await import("./load-bid-admin-url");

describe("loadBidAdminUrl", () => {
  beforeEach(() => loadStaffProducts.mockReset());

  it("gives Bid admin's address to a person who can open it", async () => {
    loadStaffProducts.mockResolvedValue([
      { id: "bid-admin", href: "https://bid.example/admin" },
      { id: "lax-admin", href: "/" },
    ]);
    expect(await loadBidAdminUrl()).toBe("https://bid.example/admin");
  });

  it("gives nothing to a person who cannot, or when Bid cannot say", async () => {
    loadStaffProducts.mockResolvedValue([{ id: "lax-admin", href: "/" }]);
    expect(await loadBidAdminUrl()).toBeNull();
  });
});
