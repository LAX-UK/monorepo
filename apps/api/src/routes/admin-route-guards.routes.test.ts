import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

/**
 * Access-matrix regression tests for admin route guard composition.
 *
 * Hono merges a sub-app's `use()` middleware into the parent router on
 * `.route()`. Two bugs this guards against:
 * 1. A `use("*", mw)` registered after a sub-app's routes never protects them
 *    and instead gates every route mounted later (locked all non-auction.manage
 *    staff out of /admin/users, /admin/clients, etc.).
 * 2. platform's `use("*", requirePlatformShell)` leaking onto the finance
 *    sub-app, locking finance_ops out of /admin/finance/*.
 */

function buildApp(staffRole: string) {
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      users: {
        list: vi.fn().mockResolvedValue({ total: 0, rows: [] }),
      },
      disputeCases: {
        countOpenCases: vi.fn().mockResolvedValue(0),
      },
    },
    telephoneBidBookingService: {
      countGlobalPending: vi.fn().mockResolvedValue(0),
    },
    onsiteEventRsvpService: {
      listAdminEvents: vi.fn().mockResolvedValue([]),
    },
  } as unknown as Container;

  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "staff-user-id", role: "staff", staffRole }),
  };

  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return app;
}

const get = (app: Hono, path: string) => app.request(`http://test${path}`);

describe("admin route guard composition", () => {
  it("client_advisor can list users but cannot reach auction.manage routes", async () => {
    const app = buildApp("client_advisor");

    expect((await get(app, "/admin/users?limit=1")).status).toBe(200);
    expect((await get(app, "/admin/telephone-bookings/pending-count")).status).toBe(403);
    expect((await get(app, "/admin/event-rsvps")).status).toBe(403);
    expect((await get(app, "/admin/finance/disputes/open-count")).status).toBe(403);
  });

  it("super_admin can reach all of them", async () => {
    const app = buildApp("super_admin");

    expect((await get(app, "/admin/users?limit=1")).status).toBe(200);
    expect((await get(app, "/admin/telephone-bookings/pending-count")).status).toBe(200);
    expect((await get(app, "/admin/event-rsvps")).status).toBe(200);
    expect((await get(app, "/admin/finance/disputes/open-count")).status).toBe(200);
  });

  it("finance_ops can reach finance routes but not the platform shell", async () => {
    const app = buildApp("finance_ops");

    expect((await get(app, "/admin/finance/disputes/open-count")).status).toBe(200);
    expect((await get(app, "/admin/users?limit=1")).status).toBe(403);
    expect((await get(app, "/admin/telephone-bookings/pending-count")).status).toBe(403);
  });
});
