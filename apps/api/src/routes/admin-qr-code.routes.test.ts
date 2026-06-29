import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

function createQrCodesContainer(qrCodes: Container["admin"]["qrCodes"]) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      qrCodes,
    },
  } as unknown as Container;
}

describe("admin QR code routes", () => {
  it("GET /qr-codes/:id/analytics resolves range presets and returns detailed analytics", async () => {
    const getDetailedAnalytics = vi.fn().mockResolvedValue({
      source: "raw",
      granularity: "hour",
      rangeKey: "24h",
      totalScans: 4,
      uniqueIps: 2,
      trend: [],
      byDevice: [],
      byCountry: [],
      byBrowser: [],
      byOs: [],
      byReferrer: [],
      recentScans: [],
    });
    const container = createQrCodesContainer({ getDetailedAnalytics } as never);
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "staff-user-id", role: "staff", staffRole: "super_admin" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      "http://test/admin/qr-codes/22222222-2222-4222-8222-222222222222/analytics?range=24h",
    );

    expect(res.status).toBe(200);
    expect(getDetailedAnalytics).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      expect.objectContaining({ source: "raw", granularity: "hour", rangeKey: "24h" }),
    );
  });

  it("GET /qr-codes/:id/analytics resolves custom from/to ranges", async () => {
    const getDetailedAnalytics = vi.fn().mockResolvedValue({
      source: "daily",
      granularity: "day",
      rangeKey: "custom",
      totalScans: 0,
      uniqueIps: null,
      trend: [],
      byDevice: [],
      byCountry: [],
      byBrowser: null,
      byOs: null,
      byReferrer: null,
      recentScans: null,
    });
    const container = createQrCodesContainer({ getDetailedAnalytics } as never);
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "staff-user-id", role: "staff", staffRole: "super_admin" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      "http://test/admin/qr-codes/22222222-2222-4222-8222-222222222222/analytics?from=2026-06-01T00:00:00.000Z&to=2026-06-10T23:59:59.999Z",
    );

    expect(res.status).toBe(200);
    expect(getDetailedAnalytics).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      expect.objectContaining({ rangeKey: "custom", source: "daily", granularity: "day" }),
    );
  });

  it("GET /qr-codes/:id/analytics rejects invalid custom ranges", async () => {
    const getDetailedAnalytics = vi.fn();
    const container = createQrCodesContainer({ getDetailedAnalytics } as never);
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "staff-user-id", role: "staff", staffRole: "super_admin" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      "http://test/admin/qr-codes/22222222-2222-4222-8222-222222222222/analytics?from=2026-06-10T00:00:00.000Z&to=2026-06-01T00:00:00.000Z",
    );

    expect(res.status).toBe(400);
    expect(getDetailedAnalytics).not.toHaveBeenCalled();
  });

  it("POST /qr-codes/regenerate regenerates the default QR code", async () => {
    const regenerateDefault = vi.fn().mockResolvedValue({
      id: "qr_2",
      shortCode: "NEW12345",
      shortUrl: "https://web.example.test/q/NEW12345",
      entityType: "lot",
      entityId: "11111111-1111-4111-8111-111111111111",
      destinationUrl: "https://web.example.test/lot/test",
      campaign: null,
      placement: null,
      status: "active",
      expiresAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const container = createQrCodesContainer({ regenerateDefault } as never);
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "staff-user-id", role: "staff", staffRole: "super_admin" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/qr-codes/regenerate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "lot",
        entityId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    expect(res.status).toBe(201);
    expect(regenerateDefault).toHaveBeenCalledWith({
      entityType: "lot",
      entityId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "staff-user-id",
    });
  });
});
