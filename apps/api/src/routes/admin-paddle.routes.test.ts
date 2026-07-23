import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const SALE_ID = "00000000-0000-4000-8000-000000000002";
const LOT_ID = "00000000-0000-4000-8000-000000000001";
const REG_ID = "00000000-0000-4000-8000-0000000000a1";

function buildPaddleApp() {
  const placeClerkPaddleBid = vi.fn().mockResolvedValue({
    httpStatus: 201,
    body: { data: { id: "bid-paddle-1", amount: "500.00" } },
  });
  const assignPaddle = vi.fn().mockResolvedValue(ok({ paddleNumber: 142 }));
  const clearPaddle = vi.fn().mockResolvedValue(ok(undefined));
  const listSaleRoster = vi.fn().mockResolvedValue([
    {
      paddleNumber: 142,
      userId: "buyer-user",
      displayName: "Jane",
      bidLimit: null,
      hasActiveSelfServiceSession: false,
    },
  ]);

  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      disputeCases: { countOpenCases: vi.fn().mockResolvedValue(0) },
      liveBidding: { placeClerkPaddleBid, assignPaddle, clearPaddle, listSaleRoster },
      onsiteEvents: { listAdminEvents: vi.fn().mockResolvedValue([]) },
    },
    redis: {
      multi: () => ({
        zadd: vi.fn().mockReturnThis(),
        zremrangebyscore: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1],
          [null, 0],
          [null, 1],
          [null, 0],
        ]),
      }),
    },
  } as unknown as Container;

  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "clerk-1", role: "staff", staffRole: "super_admin" }),
  };

  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return {
    app,
    placeClerkPaddleBid,
    assignPaddle,
    clearPaddle,
    listSaleRoster,
  };
}

describe("paddle admin routes", () => {
  it("POST /admin/saleroom/paddle-bids resolves paddle and places bid", async () => {
    const { app, placeClerkPaddleBid } = buildPaddleApp();
    const res = await app.request("http://test/admin/saleroom/paddle-bids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 500,
      }),
    });

    expect(res.status).toBe(201);
    expect(placeClerkPaddleBid).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 500,
        clerkUserId: "clerk-1",
      }),
    );
  });

  it("POST /admin/sales/:saleId/registrations/:registrationId/paddle assigns paddle", async () => {
    const { app, assignPaddle } = buildPaddleApp();
    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations/${REG_ID}/paddle`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paddleNumber: 142 }),
      },
    );

    expect(res.status).toBe(200);
    expect(assignPaddle).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: SALE_ID,
        registrationId: REG_ID,
        clerkUserId: "clerk-1",
        paddleNumber: 142,
      }),
    );
  });

  it("DELETE /admin/sales/:saleId/registrations/:registrationId/paddle clears paddle", async () => {
    const { app, clearPaddle } = buildPaddleApp();
    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations/${REG_ID}/paddle`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(200);
    expect(clearPaddle).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: SALE_ID,
        registrationId: REG_ID,
        clerkUserId: "clerk-1",
      }),
    );
  });

  it("GET /admin/sales/:saleId/paddles lists roster", async () => {
    const { app, listSaleRoster } = buildPaddleApp();
    const res = await app.request(`http://test/admin/sales/${SALE_ID}/paddles`);

    expect(res.status).toBe(200);
    expect(listSaleRoster).toHaveBeenCalledWith(SALE_ID);
    const json = (await res.json()) as { data?: { items?: unknown[] } };
    expect(json.data?.items?.length).toBe(1);
  });
});
