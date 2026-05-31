import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

describe("admin QR code routes", () => {
  it("POST /qr-codes/regenerate regenerates the default QR code", async () => {
    const regenerateDefault = vi.fn().mockResolvedValue({
      id: "qr_2",
      shortCode: "NEW12345",
      shortUrl: "https://api.example.test/q/NEW12345",
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
    const container = {
      env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
      admin: {
        requestLifecycle: {
          isSuspended: vi.fn().mockResolvedValue(false),
          reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
        },
      },
      qrCodeService: { regenerateDefault },
    } as unknown as Container;
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
