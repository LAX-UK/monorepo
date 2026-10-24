import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadStaffProducts } from "./load-staff-products";

const { getServerMyStaffTools } = vi.hoisted(() => ({ getServerMyStaffTools: vi.fn() }));
vi.mock("@/lib/data/http/staff-tools.server", () => ({ getServerMyStaffTools }));

const ids = (products: { id: string }[]) => products.map((p) => p.id);

describe("loadStaffProducts", () => {
  beforeEach(() => {
    vi.stubEnv("LAX_SHOP_ADMIN_URL", "https://admin.shop.example.test/");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("offers LAX Admin when the Bid API says the person holds a Shop role", async () => {
    getServerMyStaffTools.mockResolvedValue(["bid-admin", "lax-admin"]);

    const products = await loadStaffProducts();

    expect(ids(products)).toEqual(["bid-admin", "lax-admin"]);
    expect(products[1]?.href).toBe("https://admin.shop.example.test");
  });

  it("hides LAX Admin from Bid-only staff", async () => {
    getServerMyStaffTools.mockResolvedValue(["bid-admin"]);

    expect(ids(await loadStaffProducts())).toEqual(["bid-admin"]);
  });

  it("hides LAX Admin when the answer is unavailable", async () => {
    getServerMyStaffTools.mockResolvedValue([]);

    expect(ids(await loadStaffProducts())).toEqual(["bid-admin"]);
  });

  it("hides LAX Admin when its address is not configured", async () => {
    vi.stubEnv("LAX_SHOP_ADMIN_URL", "");
    vi.stubEnv("SHOP_ADMIN_URL", "");
    getServerMyStaffTools.mockResolvedValue(["bid-admin", "lax-admin"]);

    expect(ids(await loadStaffProducts())).toEqual(["bid-admin"]);
  });
});
