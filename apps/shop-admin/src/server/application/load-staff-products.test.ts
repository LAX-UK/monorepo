import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffToolsAnswer, StaffToolsCaller } from "../ports/staff-tools-access";

const SUBJECT = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const { toolsFor, sessionGet, cookieGet } = vi.hoisted(() => ({
  toolsFor: vi.fn<(caller: StaffToolsCaller) => Promise<StaffToolsAnswer>>(),
  sessionGet: vi.fn(),
  cookieGet: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock("../container", () => ({
  getShopAdminContainer: () => ({
    config: { NODE_ENV: "test", bidPublicUrl: "https://bid.example.test" },
    sessions: { get: sessionGet },
    staffTools: { toolsFor },
  }),
}));

const { loadStaffProducts } = await import("./load-staff-products");
const ids = (products: { id: string }[]) => products.map((p) => p.id);

describe("loadStaffProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue({ value: "session-1" });
    sessionGet.mockResolvedValue({ subject: SUBJECT, idToken: "id-token-for-test" });
  });

  it("offers Bid admin to a person Bid says can open it", async () => {
    toolsFor.mockResolvedValue({ status: "ok", tools: ["bid-admin", "lax-admin"] });

    const products = await loadStaffProducts();

    expect(toolsFor).toHaveBeenCalledWith({ subjectId: SUBJECT, idToken: "id-token-for-test" });
    expect(ids(products)).toEqual(["bid-admin", "lax-admin"]);
    expect(products[0]?.href).toBe("https://bid.example.test/admin");
  });

  it("hides Bid admin from a person without a Bid staff role", async () => {
    toolsFor.mockResolvedValue({ status: "ok", tools: ["lax-admin"] });

    expect(ids(await loadStaffProducts())).toEqual(["lax-admin"]);
  });

  it("fails closed when the Bid call is unavailable", async () => {
    toolsFor.mockResolvedValue({ status: "unavailable" });

    expect(ids(await loadStaffProducts())).toEqual(["lax-admin"]);
  });

  it("fails closed when the lookup throws or there is no session", async () => {
    toolsFor.mockRejectedValue(new Error("boom"));
    expect(ids(await loadStaffProducts())).toEqual(["lax-admin"]);

    sessionGet.mockResolvedValue(null);
    expect(ids(await loadStaffProducts())).toEqual(["lax-admin"]);
  });
});
