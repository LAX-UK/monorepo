import { SavedViewsError } from "@auction/staff-ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSavedViewsPort } from "./saved-views-port.client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("document", { cookie: "lax-shop-admin-csrf=token-value" });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};

describe("the LAX Admin saved views port", () => {
  const port = createSavedViewsPort("lax-admin.orders");

  it("loads one list's views through the staff proxy", async () => {
    fetchMock.mockResolvedValue(
      reply(200, {
        items: [
          {
            id: "a",
            listKey: "lax-admin.orders",
            label: "Paid",
            query: "status=paid",
            position: 0,
          },
        ],
      }),
    );

    expect(await port.load()).toEqual([{ id: "a", label: "Paid", query: "status=paid" }]);
    expect(lastCall().url).toBe("/api/admin/saved-views?listKey=lax-admin.orders");
    expect(lastCall().headers["x-csrf-token"]).toBeUndefined();
  });

  it("sends the list, name and query on create, with the CSRF token", async () => {
    fetchMock.mockResolvedValue(
      reply(201, {
        id: "a",
        listKey: "lax-admin.orders",
        label: "Paid",
        query: "status=paid",
        position: 0,
      }),
    );

    expect(await port.create({ label: "Paid", query: "status=paid" })).toEqual({
      id: "a",
      label: "Paid",
      query: "status=paid",
    });
    const { init, headers } = lastCall();
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      listKey: "lax-admin.orders",
      label: "Paid",
      query: "status=paid",
    });
    expect(headers["x-csrf-token"]).toBe("token-value");
  });

  it("renames, reorders and deletes by id", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { id: "a b", listKey: "lax-admin.orders", label: "New", query: "", position: 0 }),
    );
    await port.rename("a b", "New");
    expect(lastCall().url).toBe("/api/admin/saved-views/a%20b");
    expect(lastCall().init.method).toBe("PATCH");

    fetchMock.mockResolvedValueOnce(reply(200, { items: [] }));
    await port.reorder(["b", "a"]);
    expect(lastCall().url).toBe("/api/admin/saved-views/order");
    expect(JSON.parse(lastCall().init.body as string)).toEqual({
      listKey: "lax-admin.orders",
      ids: ["b", "a"],
    });

    fetchMock.mockResolvedValueOnce(reply(204));
    await port.remove("a");
    expect(lastCall().init.method).toBe("DELETE");
  });

  it.each([
    ["shop.saved_view_duplicate", 409, "duplicate"],
    ["shop.saved_view_limit", 409, "limit"],
    ["shop.saved_view_order_changed", 409, "stale"],
  ])("turns %s into a %s error with the server's words", async (serverCode, status, code) => {
    fetchMock.mockResolvedValue(reply(status, { code: serverCode, message: "Say this." }));

    await expect(port.create({ label: "x", query: "" })).rejects.toMatchObject({
      name: "SavedViewsError",
      code,
      message: "Say this.",
    });
  });

  it("treats a missing view as changed elsewhere", async () => {
    fetchMock.mockResolvedValue(reply(404, { code: "shop.not_found", message: "View not found" }));

    await expect(port.remove("a")).rejects.toMatchObject({ code: "stale" });
  });

  it("gives a plain failure for anything else, without leaking the server's message", async () => {
    fetchMock.mockResolvedValue(reply(500, { code: "shop.internal", message: "stack trace" }));

    const error = await port.load().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SavedViewsError);
    expect(error).toMatchObject({ code: "failed", message: "Something went wrong. Try again." });
  });

  it("reports an unreachable server as a plain failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(port.load()).rejects.toMatchObject({ code: "failed" });
  });
});
