import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";

function createAdminReadsContainer(
  partial: Pick<Container["admin"], "payments" | "catalog"> & {
    requestLifecycle: Container["admin"]["requestLifecycle"];
  },
) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: partial.requestLifecycle,
      payments: partial.payments,
      catalog: partial.catalog,
    },
  } as unknown as Container;
}

describe("admin read routes (DIP facade)", () => {
  it("GET /payments returns paginated rows for authorized finance staff", async () => {
    const page = {
      rows: [{ id: "pay-1", status: "paid" }],
      total: 1,
      offset: 0,
      limit: 25,
      summary: { totalAmountMinor: 1000, count: 1 },
    };
    const listPage = vi.fn().mockResolvedValue(page);
    const container = createAdminReadsContainer({
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      payments: { listPage } as never,
      catalog: {} as never,
    });

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

    const res = await app.request("http://test/admin/payments?limit=25&offset=0");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: typeof page.rows;
      meta: { total: number; limit: number; offset: number; summary: typeof page.summary };
    };
    expect(body.data).toEqual(page.rows);
    expect(body.meta.total).toBe(1);
    expect(body.meta.summary).toEqual(page.summary);
    expect(listPage).toHaveBeenCalledWith({ limit: 25, offset: 0 });
  });

  it("GET /artists/search returns registry hits for authorized staff", async () => {
    const hits = [{ id: "artist-1", displayName: "Monet", status: "approved" }];
    const searchArtists = vi.fn().mockResolvedValue(hits);
    const container = createAdminReadsContainer({
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      payments: {} as never,
      catalog: { searchArtists } as never,
    });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "specialist",
        scopes: ["bid.read"],
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/artists/search?q=mon&limit=10");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof hits };
    expect(body.data).toEqual(hits);
    expect(searchArtists).toHaveBeenCalledWith("mon", 10);
  });
});
