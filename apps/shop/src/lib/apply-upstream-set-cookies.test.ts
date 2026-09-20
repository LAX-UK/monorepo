import { describe, expect, it, vi } from "vitest";

const setMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: setMock })),
}));

const { applyUpstreamSetCookies } = await import("./apply-upstream-set-cookies.server.js");

describe("applyUpstreamSetCookies", () => {
  it("writes parsed Set-Cookie values to the storefront cookie store", async () => {
    setMock.mockClear();
    const response = new Response("{}", {
      headers: {
        "set-cookie": "shop_basket_token=abc123; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600",
      },
    });
    await applyUpstreamSetCookies(response);
    expect(setMock).toHaveBeenCalledWith(
      "shop_basket_token",
      "abc123",
      expect.objectContaining({ path: "/", httpOnly: true, sameSite: "lax" }),
    );
  });
});
