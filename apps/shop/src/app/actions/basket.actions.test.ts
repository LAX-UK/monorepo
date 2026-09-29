import { beforeEach, describe, expect, it, vi } from "vitest";

const shopCommerceRequest = vi.fn();
const fetchShopCommerceCsrfForMutation = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/shop-commerce-request.server", () => ({
  shopCommerceRequest,
}));
vi.mock("@/lib/shop-commerce-mutation.server", () => ({
  fetchShopCommerceCsrfForMutation,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

describe("addArtworkToBasket", () => {
  beforeEach(() => {
    shopCommerceRequest.mockReset();
    fetchShopCommerceCsrfForMutation.mockReset();
    revalidatePath.mockReset();
  });

  it("forwards CSRF and applies upstream cookies on successful PUT", async () => {
    fetchShopCommerceCsrfForMutation.mockResolvedValue({ ok: true, token: "csrf-test" });
    shopCommerceRequest.mockResolvedValue(
      new Response(JSON.stringify({ lineId: "line-1" }), {
        status: 200,
        headers: {
          "set-cookie": "shop_basket_token=guest-token; Path=/; HttpOnly; SameSite=Lax",
        },
      }),
    );

    const { addArtworkToBasket } = await import("./basket.actions.js");
    const result = await addArtworkToBasket("harbor-print", 1);

    expect(result).toEqual({ ok: true });
    expect(shopCommerceRequest).toHaveBeenCalledWith(
      "/commerce/basket/lines",
      expect.objectContaining({ method: "PUT" }),
      { applyCookies: true, csrfToken: "csrf-test" },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/basket");
  });

  it("returns csrf failure without calling commerce PUT", async () => {
    fetchShopCommerceCsrfForMutation.mockResolvedValue({ ok: false });

    const { addArtworkToBasket } = await import("./basket.actions.js");
    const result = await addArtworkToBasket("harbor-print", 1);

    expect(result.ok).toBe(false);
    expect(shopCommerceRequest).not.toHaveBeenCalled();
  });
});
