import { verifyBearerToken } from "@auction/auth/token-verifier";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "subject-1",
    payload: { scope: "shop.read" },
  })),
}));
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const USER_TOKEN = "user-token-placeholder";

describe("orders routes", () => {
  it("returns 404 when the order is missing", async () => {
    const deps = createMinimalShopApiTestDeps({
      commerce: {
        ...createMinimalShopApiTestDeps().commerce,
        getOrder: vi.fn(async () => null),
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/orders/00000000-0000-4000-8000-000000000099",
      headers: { authorization: `Bearer ${USER_TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("cancels a pending order with a JSON body the identity proxy can re-serialise", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "subject-1",
      payload: { scope: "shop.write" },
    } as never);
    const cancelCheckoutOrder = vi.fn(async () => undefined);
    const deps = createMinimalShopApiTestDeps({
      commerce: { ...createMinimalShopApiTestDeps().commerce, cancelCheckoutOrder },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();

    const orderId = "00000000-0000-4000-8000-000000000042";
    const response = await app.inject({
      method: "POST",
      url: `/v1/orders/${orderId}/cancel`,
      headers: { authorization: `Bearer ${USER_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ orderId, status: "cancelled" });
    expect(cancelCheckoutOrder).toHaveBeenCalledWith({ subject: "subject-1", orderId });
    // A 204 here would throw in the Hono proxy: `new Response(body, { status: 204 })` is invalid.
    expect(response.body.length).toBeGreaterThan(0);
    await app.close();
  });
});
