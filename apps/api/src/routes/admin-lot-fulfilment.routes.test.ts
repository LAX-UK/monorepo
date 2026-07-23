import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const LOT_ID = "00000000-0000-4000-8000-000000000001";

function createFulfilmentContainer(partial: {
  lotFulfilment?: Partial<Container["admin"]["lotFulfilment"]>;
}) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      lotFulfilment: partial.lotFulfilment,
    },
  } as unknown as Container;
}

describe("admin lot fulfilment routes (DIP facade)", () => {
  it("GET /lot-fulfilment lists rows via admin.lotFulfilment.getPage", async () => {
    const getPage = vi.fn().mockResolvedValue({
      rows: [{ lotId: LOT_ID, status: "awaiting_payment" }],
      total: 1,
      offset: 0,
      limit: 50,
      summary: {
        total: 1,
        awaitingPickup: 0,
        inTransit: 0,
        statusCounts: { awaiting_payment: 1 },
      },
    });
    const container = createFulfilmentContainer({ lotFulfilment: { getPage } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "staff-1", role: "staff", staffRole: "super_admin" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/lot-fulfilment?limit=50&offset=0");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: unknown[];
      meta: {
        total: number;
        limit: number;
        offset: number;
        summary: { total: number; statusCounts: Record<string, number> };
      };
    };
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(body.meta.summary.total).toBe(1);
    expect(body.meta.summary.statusCounts.awaiting_payment).toBe(1);
    expect(getPage).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });

  it("POST /lot-fulfilment/:lotId/release delegates approveRelease", async () => {
    const approveRelease = vi.fn().mockResolvedValue(ok({ lotId: LOT_ID, status: "released" }));
    const container = createFulfilmentContainer({ lotFulfilment: { approveRelease } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "staff-1", role: "staff", staffRole: "super_admin" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/lot-fulfilment/${LOT_ID}/release`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes: "Ready" }),
    });

    expect(res.status).toBe(200);
    expect(approveRelease).toHaveBeenCalledWith(
      expect.objectContaining({ lotId: LOT_ID, actorUserId: "staff-1", notes: "Ready" }),
    );
  });
});
