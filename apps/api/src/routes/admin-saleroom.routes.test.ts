import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const SALE_ID = "00000000-0000-4000-8000-000000000002";
const LOT_ID = "00000000-0000-4000-8000-000000000003";

function createSaleroomContainer(partial: {
  saleroom?: Partial<Container["admin"]["saleroom"]>;
  saleReadiness?: Partial<Container["admin"]["saleReadiness"]>;
}) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      saleroom: partial.saleroom,
      saleReadiness: partial.saleReadiness,
    },
  } as unknown as Container;
}

describe("admin saleroom routes (DIP facade)", () => {
  it("GET /saleroom/operations-radar returns batched snapshots", async () => {
    const items = [{ sale: { id: SALE_ID, title: "Live sale" } }];
    const listOperationsRadar = vi.fn().mockResolvedValue(items);
    const container = createSaleroomContainer({ saleroom: { listOperationsRadar } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "clerk-1",
        role: "staff",
        staffRoles: ["sales_manager"],
        scopes: ["bid.read"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/saleroom/operations-radar?limit=6");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { items } });
    expect(listOperationsRadar).toHaveBeenCalledWith(6);
  });

  it("GET /sales/readiness returns sale readiness rows", async () => {
    const items = [
      {
        saleId: SALE_ID,
        title: "Modern Art Evening",
        status: "scheduled",
        deliveryMode: "hybrid",
        startTime: "2026-08-01T18:00:00.000Z",
        daysToStart: 5,
        lotsTotal: 10,
        lotsPublished: 8,
        lotsDraft: 2,
        lotsMissingPhotos: 1,
        lotsMissingEstimates: 0,
        pendingRegistrations: 3,
        pendingTelephoneBookings: 1,
        sessionStatus: null,
        blockers: [],
        href: `/admin/sales/${SALE_ID}`,
        consoleHref: null,
      },
    ];
    const listReadiness = vi.fn().mockResolvedValue(items);
    const container = createSaleroomContainer({ saleReadiness: { listReadiness } });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "clerk-1",
        role: "staff",
        staffRoles: ["sales_manager"],
        scopes: ["bid.read"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/sales/readiness?limit=6");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { items } });
    expect(listReadiness).toHaveBeenCalledWith(6);
  });

  it("GET /sales/:saleId/operations-snapshot uses admin.saleroom", async () => {
    const snapshot = { sale: { id: SALE_ID, title: "Live sale" } };
    const getOperationsSnapshot = vi.fn().mockResolvedValue(snapshot);
    const container = createSaleroomContainer({ saleroom: { getOperationsSnapshot } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "clerk-1",
        role: "staff",
        staffRoles: ["sales_manager"],
        scopes: ["bid.read"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/sales/${SALE_ID}/operations-snapshot`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: snapshot });
    expect(getOperationsSnapshot).toHaveBeenCalledWith(SALE_ID);
  });

  it("POST /sales/:saleId/saleroom/go-live delegates to admin.saleroom", async () => {
    const goLive = vi.fn().mockResolvedValue(ok({ sessionId: "sess-1" }));
    const container = createSaleroomContainer({ saleroom: { goLive } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "clerk-1",
        role: "staff",
        staffRoles: ["sales_manager"],
        scopes: ["bid.write"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/go-live`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    expect(goLive).toHaveBeenCalledWith({ saleId: SALE_ID, actorUserId: "clerk-1" });
  });
});

describe("saleroom clerk", () => {
  function clerkApp(container: Container) {
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "clerk-1",
        role: "staff",
        staffRoles: ["saleroom_clerk"],
        scopes: ["bid.read", "bid.write"],
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));
    return app;
  }

  it("runs the saleroom", async () => {
    const goLive = vi.fn().mockResolvedValue(ok({ sessionId: "sess-1" }));
    const listOperationsRadar = vi.fn().mockResolvedValue([]);
    const app = clerkApp(
      createSaleroomContainer({ saleroom: { goLive, listOperationsRadar } as never }),
    );

    const radar = await app.request("http://test/admin/saleroom/operations-radar?limit=6");
    const live = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/go-live`, {
      method: "POST",
    });

    expect(radar.status).toBe(200);
    expect(live.status).toBe(200);
    expect(goLive).toHaveBeenCalledWith({ saleId: SALE_ID, actorUserId: "clerk-1" });
  });

  it("cannot manage the sale itself", async () => {
    const app = clerkApp(createSaleroomContainer({}));

    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations/${SALE_ID}/approve`,
      { method: "POST" },
    );

    expect(res.status).toBe(403);
  });

  it("hammers the lot the clerk names, and still hammers for a console that sends no body", async () => {
    const hammerCurrentLot = vi.fn().mockResolvedValue(ok({ lotId: LOT_ID }));
    const app = clerkApp(createSaleroomContainer({ saleroom: { hammerCurrentLot } as never }));

    const named = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/hammer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: LOT_ID }),
    });
    const bare = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/hammer`, {
      method: "POST",
    });

    expect(named.status).toBe(200);
    expect(bare.status).toBe(200);
    expect(hammerCurrentLot).toHaveBeenNthCalledWith(1, {
      saleId: SALE_ID,
      actorUserId: "clerk-1",
      lotId: LOT_ID,
    });
    expect(hammerCurrentLot).toHaveBeenNthCalledWith(2, {
      saleId: SALE_ID,
      actorUserId: "clerk-1",
    });
  });

  it("answers 409 lot_not_on_block when the named lot has left the block", async () => {
    const noSaleCurrentLot = vi.fn().mockResolvedValue(
      err({
        message: "This lot is no longer on the block",
        status: 409,
        code: "lot_not_on_block",
      }),
    );
    const app = clerkApp(createSaleroomContainer({ saleroom: { noSaleCurrentLot } as never }));

    const res = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/no-sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: LOT_ID }),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "This lot is no longer on the block",
      code: "lot_not_on_block",
    });
  });

  it("refuses a hammer whose lot id is not a lot id", async () => {
    const hammerCurrentLot = vi.fn();
    const app = clerkApp(createSaleroomContainer({ saleroom: { hammerCurrentLot } as never }));

    const res = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/hammer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: "lot-1" }),
    });

    expect(res.status).toBe(400);
    expect(hammerCurrentLot).not.toHaveBeenCalled();
  });

  it("reads the price and reserve of a lot in the sale", async () => {
    const snapshot = {
      lotId: LOT_ID,
      status: "active",
      currentPrice: "950.00",
      reservePrice: null,
    };
    const getLotSnapshot = vi.fn().mockResolvedValueOnce(snapshot).mockResolvedValueOnce(null);
    const app = clerkApp(createSaleroomContainer({ saleroom: { getLotSnapshot } as never }));

    const found = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/lots/${LOT_ID}`);
    const missing = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/lots/${LOT_ID}`);

    expect(found.status).toBe(200);
    expect(await found.json()).toEqual({ data: snapshot });
    expect(getLotSnapshot).toHaveBeenCalledWith(SALE_ID, LOT_ID);
    expect(missing.status).toBe(404);
  });

  it("cannot read a lot without saleroom access", async () => {
    const getLotSnapshot = vi.fn();
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "client-1",
        role: "client",
        staffRoles: [],
        scopes: ["bid.read"],
      }),
    };
    const app = new Hono();
    app.route(
      "/admin",
      createAdminRoutes(
        createSaleroomContainer({ saleroom: { getLotSnapshot } as never }),
        authenticator,
      ),
    );

    const res = await app.request(`http://test/admin/sales/${SALE_ID}/saleroom/lots/${LOT_ID}`);

    expect(res.status).toBe(403);
    expect(getLotSnapshot).not.toHaveBeenCalled();
  });
});
