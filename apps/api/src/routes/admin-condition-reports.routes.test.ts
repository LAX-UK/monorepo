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
  it("GET /condition-report-requests returns paginated rows for authorized staff", async () => {
    const listForAdmin = vi.fn().mockResolvedValue({
      items: [{ id: requestId, status: "pending", lotTitle: "Blue vase" }],
      total: 1,
    });
    const container = createConditionReportsContainer({ listForAdmin } as never);
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "super_admin" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      "http://test/admin/condition-report-requests?limit=25&offset=0&status=pending",
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { items: Array<{ id: string }>; total: number; limit: number; offset: number };
    };
    expect(body.data.total).toBe(1);
    expect(body.data.items[0]?.id).toBe(requestId);
    expect(listForAdmin).toHaveBeenCalledWith({
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
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "super_admin" }),
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
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "super_admin" }),
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
