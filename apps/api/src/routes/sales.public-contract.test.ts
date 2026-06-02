import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createSaleRoutes } from "./sales.js";

describe("sales public GET /:id contract", () => {
  it("returns stable data keys for sale detail", async () => {
    const app = new Hono();
    const saleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const getSaleDetailForPublicApi = vi.fn().mockResolvedValue({
      data: {
        sale: { id: saleId, title: "S", coverImages: [] },
        lots: [],
        viewer: { isFollowing: false },
      },
    });
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      saleService: { getSaleDetailForPublicApi },
      saleFollowService: {},
      saleBiddersService: { list: vi.fn() },
      mediaUrlResolver: {},
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue(null),
    };
    app.route("/sales", createSaleRoutes(container, authenticator));
    const res = await app.request(`http://t/sales/${saleId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(Object.keys(body.data).sort()).toEqual(["lots", "sale", "viewer"]);
    expect(Object.keys(body.data.viewer as object).sort()).toEqual(["isFollowing"]);
    expect(getSaleDetailForPublicApi).toHaveBeenCalledWith(
      saleId,
      undefined,
      expect.objectContaining({ role: undefined, staffRole: undefined }),
    );
  });

  it("returns 404 for draft sale detail when anonymous", async () => {
    const app = new Hono();
    const saleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const getSaleDetailForPublicApi = vi.fn().mockResolvedValue(null);
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      saleService: { getSaleDetailForPublicApi },
      saleFollowService: {},
      saleBiddersService: { list: vi.fn() },
      mediaUrlResolver: {},
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue(null),
    };
    app.route("/sales", createSaleRoutes(container, authenticator));
    const res = await app.request(`http://t/sales/${saleId}`);
    expect(res.status).toBe(404);
  });
});
