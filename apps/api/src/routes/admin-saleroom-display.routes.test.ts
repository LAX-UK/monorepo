import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";
const saleId = "00000000-0000-4000-8000-000000000002";

function createDisplayContainer(display: Container["admin"]["display"]) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      display,
    },
  } as unknown as Container;
}

describe("admin saleroom display routes", () => {
  it("GET /sales/:saleId/saleroom/display/devices returns device list for authorized staff", async () => {
    const devices = [{ pairingId: "pair-1", label: "Screen A", lastSeenAt: null }];
    const listDevices = vi.fn().mockResolvedValue(devices);
    const container = createDisplayContainer({ listDevices } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
        scopes: ["bid.read"],
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/sales/${saleId}/saleroom/display/devices`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { items: typeof devices } };
    expect(body.data.items).toEqual(devices);
    expect(listDevices).toHaveBeenCalledWith(saleId);
  });

  it("POST /sales/:saleId/saleroom/display/approve returns pairing id on success", async () => {
    const approvePairing = vi.fn().mockResolvedValue(ok({ pairingId: "pair-1" }));
    const container = createDisplayContainer({ approvePairing } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
        scopes: ["bid.write"],
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/sales/${saleId}/saleroom/display/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userCode: "ABCD1234" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { pairingId: string } };
    expect(body.data.pairingId).toBe("pair-1");
    expect(approvePairing).toHaveBeenCalledWith({
      userCode: "ABCD1234",
      saleId,
      actorUserId: staffUserId,
    });
  });

  it("POST /sales/:saleId/saleroom/display/overlay returns overlay on success", async () => {
    const overlay = {
      kind: "announcement" as const,
      message: "Intermission",
      setAt: "2026-01-01T00:00:00.000Z",
    };
    const setOverlay = vi.fn().mockResolvedValue(ok(overlay));
    const container = createDisplayContainer({ setOverlay } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
        scopes: ["bid.write"],
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/sales/${saleId}/saleroom/display/overlay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "announcement", message: "Intermission" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof overlay };
    expect(body.data).toEqual(overlay);
    expect(setOverlay).toHaveBeenCalledWith({
      saleId,
      kind: "announcement",
      message: "Intermission",
      actorUserId: staffUserId,
    });
  });

  it("GET /sales/:saleId/saleroom/display/devices returns 401 when unauthenticated", async () => {
    const container = createDisplayContainer({ listDevices: vi.fn() } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue(null),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/sales/${saleId}/saleroom/display/devices`);

    expect(res.status).toBe(401);
  });
});
