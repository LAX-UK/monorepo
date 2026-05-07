import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminPayoutRoutes } from "./payouts.js";

const payoutId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function mountApp(role: string) {
  const app = new Hono();
  const payoutService = {
    adminManualReverse: vi.fn(),
  };
  const payoutRepository = {
    findById: vi.fn(),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    payoutService,
    payoutRepository,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role }),
  };
  app.route("/admin/payouts", createAdminPayoutRoutes(container, authenticator));
  return { app, payoutService };
}

describe("admin payout routes — reverse", () => {
  it("returns 403 for POST reverse when user is accountant", async () => {
    const { app, payoutService } = mountApp("accountant");

    const res = await app.request(`/admin/payouts/${payoutId}/reverse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "duplicate payment bookkeeping correction required here",
        confirmationPhrase: `REVERSE PAYOUT ${payoutId}`,
      }),
    });

    expect(res.status).toBe(403);
    expect(payoutService.adminManualReverse).not.toHaveBeenCalled();
  });

  it("returns 400 when confirmation phrase does not match payout id", async () => {
    const { app, payoutService } = mountApp("administrator");

    const res = await app.request(`/admin/payouts/${payoutId}/reverse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "duplicate payment bookkeeping correction required here",
        confirmationPhrase: "REVERSE PAYOUT wrong-id",
      }),
    });

    expect(res.status).toBe(400);
    expect(payoutService.adminManualReverse).not.toHaveBeenCalled();
  });

  it("calls adminManualReverse for administrator with matching phrase", async () => {
    const { app, payoutService } = mountApp("administrator");
    payoutService.adminManualReverse.mockResolvedValue({
      id: payoutId,
      legalEntityId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      status: "reversed",
    });

    const reason = "duplicate payment bookkeeping correction required here";
    const res = await app.request(`/admin/payouts/${payoutId}/reverse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason,
        confirmationPhrase: `REVERSE PAYOUT ${payoutId}`,
      }),
    });

    expect(res.status).toBe(200);
    expect(payoutService.adminManualReverse).toHaveBeenCalledWith("u1", payoutId, { reason });
  });
});
