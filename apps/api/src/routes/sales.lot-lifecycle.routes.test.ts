import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createSaleRoutes } from "./sales.js";

const saleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const lotId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("POST /sales/:id/lots/:lotId/status", () => {
  function appWithMocks() {
    const app = new Hono<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>();
    const setLotStatus = vi.fn();
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      saleService: {},
      saleSoftDeleteService: { softDelete: vi.fn(), getDeleteEligibility: vi.fn() },
      saleFollowService: {},
      saleBiddersService: { list: vi.fn() },
      saleStatusTransitionService: { setLotStatus: vi.fn() },
      lotService: { getById: vi.fn(), cancel: vi.fn() },
      kycService: { isConfigured: () => false },
      catalogRoutes: {
        saleLifecycleHttp: {},
        saleLotMembershipHttp: { setLotStatus },
        lotLifecycleHttp: {},
      },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "staff-1",
        role: "staff",
        staffRole: "auction_manager",

        scopes: ["bid.write"],
      }),
    };
    app.route("/sales", createSaleRoutes(container, authenticator));
    return { app, setLotStatus };
  }

  it("delegates cancelled status to catalog sale lot membership HTTP port", async () => {
    const { app, setLotStatus } = appWithMocks();
    setLotStatus.mockResolvedValue({
      kind: "ok",
      data: { id: lotId, status: "cancelled", images: [] },
    });

    const res = await app.request(`http://t/sales/${saleId}/lots/${lotId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", reason: "ops override" }),
    });

    expect(res.status).toBe(200);
    expect(setLotStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "staff-1",
        role: "staff",
        saleId,
        lotId,
        status: "cancelled",
        reason: "ops override",
      }),
    );
  });

  it("returns use_dedicated_cancel body when membership port rejects transition", async () => {
    const { LotError } = await import("../lib/errors.js");
    const { app, setLotStatus } = appWithMocks();
    setLotStatus.mockResolvedValue({
      kind: "err",
      error: new LotError("Use dedicated cancel route", 409, "use_dedicated_cancel"),
    });

    const res = await app.request(`http://t/sales/${saleId}/lots/${lotId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "scheduled" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("use_dedicated_cancel");
  });
});
