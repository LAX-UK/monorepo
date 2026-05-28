import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";

describe("admin lots browse routes", () => {
  it("GET /lots/browse returns attachable rows for authorized staff", async () => {
    const listAttachable = vi.fn().mockResolvedValue({
      data: [
        {
          id: "lot-1",
          title: "Blue vase",
          status: "draft",
          sellerLegalEntityId: "seller-1",
          saleId: null,
          artistId: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          lifecycle: {
            kind: "new_draft",
            returnedAt: null,
            lastSaleId: null,
            lastSaleName: null,
            returnCount: 0,
          },
        },
      ],
      total: 1,
    });

    const container = {
      env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
      admin: {
        requestLifecycle: {
          isSuspended: vi.fn().mockResolvedValue(false),
          reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
        },
      },
      adminLotBrowseService: { listAttachable },
    } as unknown as Container;

    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "super_admin" }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/lots/browse?limit=25&offset=0&state=all");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string; title: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.id).toBe("lot-1");
    expect(listAttachable).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      state: "all",
    });
  });

  it("GET /lots/browse returns 401 when unauthenticated", async () => {
    const container = {
      env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
      admin: {
        requestLifecycle: {
          isSuspended: vi.fn().mockResolvedValue(false),
          reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
        },
      },
      adminLotBrowseService: { listAttachable: vi.fn() },
    } as unknown as Container;

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue(null),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/lots/browse?limit=1");

    expect(res.status).toBe(401);
  });
});
