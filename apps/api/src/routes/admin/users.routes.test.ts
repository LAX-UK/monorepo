import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import type { IAuthenticator } from "../../services/interfaces/authenticator.js";
import { InMemoryIdempotencyStore, stubStepUpGuard } from "../../testing/staff-mutation-guards.js";
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
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRoles: ["administrator"],
        scopes: ["bid.read"],
      }),
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

describe("admin users routes — set role", () => {
  function setRoleApp(setRole: ReturnType<typeof vi.fn>) {
    const container = {
      env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
      admin: {
        requestLifecycle: {
          isSuspended: vi.fn().mockResolvedValue(false),
          reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
        },
        users: { setRole },
        stepUp: stubStepUpGuard(true),
        idempotencyStore: new InMemoryIdempotencyStore(),
      },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRoles: ["administrator"],
        scopes: ["bid.read", "bid.write"],
        identitySessionId: "session-1",
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));
    return app;
  }

  const patch = (path: string) => ({
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://test" },
    body: JSON.stringify({ role: "staff", staffRole: "read_only" }),
    path,
  });

  it("changes a user's role at PATCH /admin/users/:userId/role", async () => {
    const setRole = vi.fn().mockResolvedValue({ ok: true });
    const { path, ...init } = patch("/admin/users/target-user/role");
    const res = await setRoleApp(setRole).request(`http://test${path}`, init);

    expect(res.status).toBe(200);
    expect(setRole).toHaveBeenCalledWith(
      "staff",
      staffUserId,
      "target-user",
      "staff",
      ["administrator"],
      "read_only",
    );
  });

  it("does not change roles through the source-of-funds path", async () => {
    const setRole = vi.fn().mockResolvedValue({ ok: true });
    const { path, ...init } = patch("/admin/users/target-user/source-of-funds");
    await setRoleApp(setRole).request(`http://test${path}`, init);

    expect(setRole).not.toHaveBeenCalled();
  });
});
