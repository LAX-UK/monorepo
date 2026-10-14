import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAtgAdminService } from "../services/interfaces/atg-admin-service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const SALE_ID = "11111111-1111-4111-8111-111111111111";
const LOT_ID = "22222222-2222-4222-8222-222222222222";

function buildApp(staffRole: string, atgAdmin: Partial<IAtgAdminService>) {
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
    },
    atgAdmin,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "staff-1", role: "staff", staffRole }),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return app;
}

describe("admin ATG routes", () => {
  it("lets auction managers enqueue a push and returns 202", async () => {
    const enqueueSaleAction = vi.fn().mockResolvedValue({ ok: true, jobId: "job-1" });
    const app = buildApp("auction_manager", { enqueueSaleAction });

    const res = await app.request(`http://test/admin/integrations/atg/sales/${SALE_ID}/push`, {
      method: "POST",
    });

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ data: { jobId: "job-1", action: "push" } });
    expect(enqueueSaleAction).toHaveBeenCalledWith(SALE_ID, "push");
  });

  it("forbids staff without auction.manage", async () => {
    const enqueueSaleAction = vi.fn();
    const status = vi.fn();
    const app = buildApp("finance_ops", { enqueueSaleAction, status });

    const post = await app.request(`http://test/admin/integrations/atg/sales/${SALE_ID}/push`, {
      method: "POST",
    });
    const get = await app.request("http://test/admin/integrations/atg/status");

    expect(post.status).toBe(403);
    expect(get.status).toBe(403);
    expect(enqueueSaleAction).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("reports job state to auction managers and 503 when ATG is off", async () => {
    const getJobState = vi.fn().mockResolvedValue("active");
    const app = buildApp("auction_manager", { getJobState });

    const res = await app.request("http://test/admin/integrations/atg/jobs/atg.push-sale__abc");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { jobId: "atg.push-sale__abc", state: "active" } });

    getJobState.mockResolvedValue(null);
    const off = await app.request("http://test/admin/integrations/atg/jobs/atg.push-sale__abc");
    expect(off.status).toBe(503);
    expect(await off.json()).toMatchObject({ code: "atg_disabled" });
  });

  it("forbids job status for staff without auction.manage", async () => {
    const getJobState = vi.fn();
    const app = buildApp("finance_ops", { getJobState });

    const res = await app.request("http://test/admin/integrations/atg/jobs/atg.push-sale__abc");
    expect(res.status).toBe(403);
    expect(getJobState).not.toHaveBeenCalled();
  });

  it("maps service errors to HTTP status codes", async () => {
    const enqueueSaleAction = vi.fn().mockResolvedValue({
      ok: false,
      error: { status: 503, code: "atg_disabled", message: "off" },
    });
    const app = buildApp("super_admin", { enqueueSaleAction });

    const res = await app.request(`http://test/admin/integrations/atg/sales/${SALE_ID}/publish`, {
      method: "POST",
    });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "off", code: "atg_disabled" });
  });

  it("rejects unknown actions and malformed ids before reaching the service", async () => {
    const enqueueSaleAction = vi.fn();
    const app = buildApp("super_admin", { enqueueSaleAction });

    const badAction = await app.request(
      `http://test/admin/integrations/atg/sales/${SALE_ID}/unpublish`,
      { method: "POST" },
    );
    const badId = await app.request("http://test/admin/integrations/atg/sales/not-a-uuid/push", {
      method: "POST",
    });

    expect(badAction.status).toBe(400);
    expect(badId.status).toBe(400);
    expect(enqueueSaleAction).not.toHaveBeenCalled();
  });

  it("returns the sale sync view and 404 for missing sales", async () => {
    const getSale = vi
      .fn()
      .mockResolvedValueOnce({ saleId: SALE_ID, linked: true, lots: [] })
      .mockResolvedValueOnce(null);
    const app = buildApp("auction_manager", { getSale });

    const found = await app.request(`http://test/admin/integrations/atg/sales/${SALE_ID}`);
    const missing = await app.request(`http://test/admin/integrations/atg/sales/${SALE_ID}`);

    expect(found.status).toBe(200);
    expect(await found.json()).toEqual({ data: { saleId: SALE_ID, linked: true, lots: [] } });
    expect(missing.status).toBe(404);
  });

  it("enqueues ATG lot deletion", async () => {
    const enqueueLotDelete = vi.fn().mockResolvedValue({ ok: true, jobId: "job-2" });
    const app = buildApp("operations", { enqueueLotDelete });

    const res = await app.request(`http://test/admin/integrations/atg/lots/${LOT_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(202);
    expect(enqueueLotDelete).toHaveBeenCalledWith(LOT_ID);
  });
});
