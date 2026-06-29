import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const SALE_ID = "00000000-0000-4000-8000-000000000002";

function createSaleroomContainer(partial: {
  saleroom?: Partial<Container["admin"]["saleroom"]>;
}) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      saleroom: partial.saleroom,
    },
  } as unknown as Container;
}

describe("admin saleroom routes (DIP facade)", () => {
  it("GET /sales/:saleId/operations-snapshot uses admin.saleroom", async () => {
    const snapshot = { sale: { id: SALE_ID, title: "Live sale" } };
    const getOperationsSnapshot = vi.fn().mockResolvedValue(snapshot);
    const container = createSaleroomContainer({ saleroom: { getOperationsSnapshot } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "clerk-1", role: "staff", staffRole: "auction_manager" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/sales/${SALE_ID}/operations-snapshot`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: snapshot });
    expect(getOperationsSnapshot).toHaveBeenCalledWith(SALE_ID);
  });

  it("POST /sales/:saleId/saleroom/go-live delegates to admin.saleroom", async () => {
    const goLive = vi.fn().mockResolvedValue(ok({ sessionId: "sess-1" }));
    const container = createSaleroomContainer({ saleroom: { goLive } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "clerk-1", role: "staff", staffRole: "auction_manager" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/go-live`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    expect(goLive).toHaveBeenCalledWith({ saleId: SALE_ID, actorUserId: "clerk-1" });
  });
});
