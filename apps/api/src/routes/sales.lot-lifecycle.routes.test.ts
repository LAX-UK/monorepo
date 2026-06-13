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
    const cancel = vi.fn();
    const setLotStatus = vi.fn();
    const getById = vi.fn().mockResolvedValue({ id: lotId, saleId });
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      saleService: {},
      saleSoftDeleteService: { softDelete: vi.fn(), getDeleteEligibility: vi.fn() },
      saleFollowService: {},
      saleBiddersService: { list: vi.fn() },
      mediaUrlResolver: { resolveManyUnique: vi.fn().mockResolvedValue(new Map()) },
      lotService: {
        getById,
        cancel,
      },
      saleStatusTransitionService: { setLotStatus },
      kycService: { isConfigured: () => false },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "staff-1",
        role: "staff",
        staffRole: "auction_manager",
      }),
    };
    app.route("/sales", createSaleRoutes(container, authenticator));
    return { app, cancel, setLotStatus, getById };
  }

  it("delegates cancelled status to LotService.cancel", async () => {
    const { ok } = await import("neverthrow");
    const { app, cancel, setLotStatus } = appWithMocks();
    cancel.mockResolvedValue(ok({ id: lotId, status: "cancelled", images: [] }));

    const res = await app.request(`http://t/sales/${saleId}/lots/${lotId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", reason: "ops override" }),
    });

    expect(res.status).toBe(200);
    expect(cancel).toHaveBeenCalledWith(
      "staff-1",
      "staff",
      lotId,
      "auction_manager",
      "admin_override",
    );
    expect(setLotStatus).not.toHaveBeenCalled();
  });

  it("returns use_dedicated_cancel body when setLotStatus rejects cancelled", async () => {
    const { err } = await import("neverthrow");
    const { LotError } = await import("../lib/errors.js");
    const { app, cancel, setLotStatus } = appWithMocks();
    setLotStatus.mockResolvedValue(
      err(new LotError("Use dedicated cancel route", 409, "use_dedicated_cancel")),
    );

    const res = await app.request(`http://t/sales/${saleId}/lots/${lotId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "scheduled" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("use_dedicated_cancel");
    expect(cancel).not.toHaveBeenCalled();
  });
});
