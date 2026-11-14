import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.fn();
let down = false;
vi.mock("@/lib/shop-commerce-request.server", () => ({
  shopCommerceRequest: (...args: unknown[]) => {
    if (down) {
      request(...args);
      return Promise.reject(new Error("down"));
    }
    return request(...args);
  },
}));

import { GET } from "./route";

const ORDER_ID = "550e8400-e29b-41d4-a716-846655440001";
const DOCUMENT_ID = "550e8400-e29b-41d4-a716-846655440077";
const call = (orderId = ORDER_ID, documentId = DOCUMENT_ID) =>
  GET(new Request("http://shop.test"), { params: Promise.resolve({ orderId, documentId }) });

describe("Shop order document route", () => {
  beforeEach(() => request.mockReset());

  it("passes LAX's stored copy on as a PDF, never cached", async () => {
    request.mockResolvedValue(
      new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'attachment; filename="invoice-LAX-INV-000124.pdf"',
        },
      }),
    );
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toContain("invoice-LAX-INV-000124.pdf");
    expect(request).toHaveBeenCalledWith(
      `/commerce/orders/${ORDER_ID}/invoice-documents/${DOCUMENT_ID}`,
      expect.anything(),
    );
  });

  it.each([
    ["signed out", () => new Response("{}", { status: 401 })],
    ["refused", () => new Response("{}", { status: 403 })],
    ["not found", () => new Response("{}", { status: 404 })],
    ["API error", () => new Response("{}", { status: 500 })],
    ["no content", () => new Response(null, { status: 204 })],
    [
      "not a PDF",
      () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
    ],
  ])("answers %s with the same uncached 404", async (_why, make) => {
    request.mockResolvedValue(make());
    const response = await call();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "document_unavailable" });
  });

  it("answers an API that is down, or an id that is not one, the same way", async () => {
    // A plain rejecting function: the fetch failing, as the network would.
    down = true;
    expect((await call()).status).toBe(404);
    down = false;
    const bad = await call(ORDER_ID, "../../etc");
    expect(bad.status).toBe(404);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
