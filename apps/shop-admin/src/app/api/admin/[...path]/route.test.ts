import { afterEach, describe, expect, it, vi } from "vitest";

const forwardAdminRequest = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("../../../../server/container", () => ({
  getShopAdminContainer: () => ({
    config: { publicOrigin: "https://admin.example.com" },
    sessions: {},
    adminApi: {},
    clock: {},
    forwardAdminRequest,
  }),
}));

const context = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const call = (method: string) =>
  new Request("https://admin.example.com/api/admin/saved-views/order", {
    method,
    headers: { "content-type": "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify({ ids: ["a"] }) }),
  });

afterEach(() => {
  forwardAdminRequest.mockReset();
  vi.restoreAllMocks();
});

describe("admin BFF methods", () => {
  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"])("exports %s", async (method) => {
    const route = (await import("./route.js")) as Record<string, unknown>;
    expect(typeof route[method]).toBe("function");
  });

  it("forwards a PUT, so saved views can be reordered", async () => {
    forwardAdminRequest.mockResolvedValue({
      status: 200,
      headers: { "content-type": "application/json" },
      body: new TextEncoder().encode("{}").buffer,
    });
    const { PUT } = await import("./route.js");
    const response = await PUT(call("PUT"), context("saved-views", "order"));
    expect(response.status).toBe(200);
    expect(forwardAdminRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "PUT", bffPath: "/api/admin/saved-views/order" }),
    );
  });
});

describe("admin BFF query string", () => {
  it("passes the query string to the forwarder", async () => {
    forwardAdminRequest.mockResolvedValue({
      status: 200,
      headers: { "content-type": "application/json" },
      body: new TextEncoder().encode("{}").buffer,
    });
    const { GET } = await import("./route.js");
    await GET(
      new Request("https://admin.example.com/api/admin/saved-views?listKey=orders"),
      context("saved-views"),
    );
    expect(forwardAdminRequest).toHaveBeenCalledWith(
      expect.objectContaining({ bffPath: "/api/admin/saved-views", search: "?listKey=orders" }),
    );
  });
});

describe("admin BFF error body", () => {
  it("does not return the error message to the browser, and logs it", async () => {
    const detail = "connect ECONNREFUSED 10.0.3.7:3011 at /srv/shop-api/internal";
    forwardAdminRequest.mockRejectedValue(new Error(detail));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./route.js");

    const response = await POST(call("POST"), context("refunds"));

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: "request_failed" });
    expect(text).not.toContain("10.0.3.7");
    expect(log).toHaveBeenCalledWith(
      "[shop-admin.bff] admin request failed",
      expect.objectContaining({ path: "/api/admin/refunds", message: detail }),
    );
  });

  it.each([
    ["Unauthorized", 401, "unauthorized"],
    ["Not found", 404, "not_found"],
    ["CSRF token missing or invalid", 403, "forbidden"],
    ["Cross-origin admin mutation rejected", 403, "forbidden"],
  ])("keeps the fixed code for %s", async (message, status, code) => {
    forwardAdminRequest.mockRejectedValue(new Error(message));
    const { POST } = await import("./route.js");
    const response = await POST(call("POST"), context("refunds"));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  });
});
