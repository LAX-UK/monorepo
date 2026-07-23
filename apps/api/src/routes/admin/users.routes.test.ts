import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import type { IAuthenticator } from "../../services/interfaces/authenticator.js";
import { createAdminRoutes } from "../admin.js";

const staffUserId = "staff-user-id";

function createUsersListContainer(getPage: ReturnType<typeof vi.fn>) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      users: { getPage },
    },
  } as unknown as Container;
}

describe("admin users routes — list page", () => {
  it("returns paginated rows with summary meta", async () => {
    const getPage = vi.fn().mockResolvedValue({
      rows: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
      total: 1,
      offset: 0,
      limit: 25,
      summary: {
        total: 1,
        active: 1,
        suspended: 0,
        emailVerified: 1,
        kycVerified: 0,
        byStaffRole: {},
      },
    });
    const container = createUsersListContainer(getPage);
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "super_admin" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/users?limit=25&offset=0");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: unknown[];
      meta: {
        total: number;
        limit: number;
        offset: number;
        summary: { active: number; kycVerified: number };
      };
    };
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(body.meta.limit).toBe(25);
    expect(body.meta.offset).toBe(0);
    expect(body.meta.summary.active).toBe(1);
    expect(body.meta.summary.kycVerified).toBe(0);
    expect(getPage).toHaveBeenCalledOnce();
  });
});
