import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";
const requestId = "33333333-3333-4333-8333-333333333333";

function createConditionReportsContainer(conditionReports: Container["admin"]["conditionReports"]) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      conditionReports,
    },
  } as unknown as Container;
}

describe("admin condition report routes", () => {
  it("uses the shared condition-report capability requirement", async () => {
    const getPage = vi.fn();
    const container = createConditionReportsContainer({ getPage } as never);
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "auction_manager",
        scopes: ["bid.read"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/condition-report-requests?limit=25&offset=0");

    expect(res.status).toBe(403);
    expect(getPage).not.toHaveBeenCalled();
  });

  it("GET /condition-report-requests returns paginated rows with meta.summary", async () => {
    const getPage = vi.fn().mockResolvedValue({
      rows: [{ id: requestId, status: "pending", lotTitle: "Blue vase" }],
      total: 1,
      offset: 0,
      limit: 25,
      summary: {
        total: 1,
        open: 1,
        pending: 1,
        inProgress: 0,
        fulfilled: 0,
        declined: 0,
      },
    });
    const container = createConditionReportsContainer({ getPage } as never);
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

    const res = await app.request(
      "http://test/admin/condition-report-requests?limit=25&offset=0&status=pending",
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string }>;
      meta: {
        total: number;
        limit: number;
        offset: number;
        summary: { open: number; pending: number };
      };
    };
    expect(body.meta.total).toBe(1);
    expect(body.data[0]?.id).toBe(requestId);
    expect(body.meta.summary.open).toBe(1);
    expect(body.meta.summary.pending).toBe(1);
    expect(getPage).toHaveBeenCalledWith({
      status: "pending",
      limit: 25,
      offset: 0,
    });
  });

  it("POST /condition-report-requests/:id/fulfill returns presented lot data", async () => {
    const lot = {
      id: "lot-1",
      title: "Blue vase",
      images: ["img-key-1"],
      imageAssets: [{ key: "img-key-1", url: "https://cdn.example/img.jpg" }],
    };
    const fulfill = vi.fn().mockResolvedValue(ok(lot));
    const container = createConditionReportsContainer({ fulfill } as never);
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

    const res = await app.request(
      `http://test/admin/condition-report-requests/${requestId}/fulfill`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conditionReport: { summary: "Good condition", downloadUrl: "https://example.com/cr.pdf" },
        }),
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof lot };
    expect(body.data).toEqual(lot);
    expect(fulfill).toHaveBeenCalledWith({
      id: requestId,
      fulfilledByUserId: staffUserId,
      conditionReport: { summary: "Good condition", downloadUrl: "https://example.com/cr.pdf" },
    });
  });

  it("POST /condition-report-requests/:id/decline returns ok for authorized staff", async () => {
    const decline = vi.fn().mockResolvedValue(ok(undefined));
    const container = createConditionReportsContainer({ decline } as never);
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

    const res = await app.request(
      `http://test/admin/condition-report-requests/${requestId}/decline`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responseNote: "Not available" }),
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(decline).toHaveBeenCalledWith({
      id: requestId,
      fulfilledByUserId: staffUserId,
      responseNote: "Not available",
    });
  });
});
