import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";
const SALE_ID = "00000000-0000-4000-8000-000000000002";
const REG_ID = "00000000-0000-4000-8000-0000000000a1";

function createSaleRegistrationsContainer(partial: {
  saleRegistrations?: Container["admin"]["saleRegistrations"];
}) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      saleRegistrations: partial.saleRegistrations,
    },
  } as unknown as Container;
}

describe("admin sale registration routes (DIP facade)", () => {
  it("GET /sales/:saleId/registrations returns listForSaleAdmin rows", async () => {
    const items = [{ id: REG_ID, status: "pending" }];
    const listForSaleAdmin = vi.fn().mockResolvedValue(items);
    const container = createSaleRegistrationsContainer({
      saleRegistrations: { listForSaleAdmin } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "auction_manager" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations?status=pending`,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { items } });
    expect(listForSaleAdmin).toHaveBeenCalledWith({ saleId: SALE_ID, status: "pending" });
  });

  it("POST /sales/:saleId/registrations/:registrationId/approve delegates to facade", async () => {
    const approve = vi.fn().mockResolvedValue(ok(undefined));
    const container = createSaleRegistrationsContainer({
      saleRegistrations: { approve } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "auction_manager" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations/${REG_ID}/approve`,
      { method: "POST" },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(approve).toHaveBeenCalledWith({
      saleId: SALE_ID,
      registrationId: REG_ID,
      decidedByUserId: staffUserId,
    });
  });

  it("POST /sales/:saleId/registrations/:registrationId/reject maps service error status", async () => {
    const reject = vi.fn().mockResolvedValue(
      err({
        message: "Only pending registrations can be rejected",
        status: 409,
      }),
    );
    const container = createSaleRegistrationsContainer({
      saleRegistrations: { reject } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "auction_manager" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations/${REG_ID}/reject`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Incomplete KYC" }),
      },
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Only pending registrations can be rejected",
    });
  });

  it("PATCH /sales/:saleId/registrations/:registrationId/bid-limit delegates to facade", async () => {
    const updateBidLimit = vi.fn().mockResolvedValue(ok(undefined));
    const container = createSaleRegistrationsContainer({
      saleRegistrations: { updateBidLimit } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "auction_manager" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations/${REG_ID}/bid-limit`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bidLimit: 50000 }),
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateBidLimit).toHaveBeenCalledWith({
      saleId: SALE_ID,
      registrationId: REG_ID,
      bidLimit: 50000,
      decidedByUserId: staffUserId,
    });
  });
});
