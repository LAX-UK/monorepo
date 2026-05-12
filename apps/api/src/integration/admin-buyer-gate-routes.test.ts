import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createBidRoutes } from "../routes/bids.js";
import { createPaymentRoutes } from "../routes/payments.js";
import { createSubmissionRoutes } from "../routes/submissions.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const lotId = "00000000-0000-4000-8000-000000000001";
const submissionId = "00000000-0000-4000-8000-000000000002";

const adminAuth: IAuthenticator = {
  getSessionUser: async () => ({
    id: "admin-user",
    role: "staff",
    staffRole: "super_admin",
  }),
};

function minimalContainer(partial: Record<string, unknown>): Container {
  return {
    redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), ping: vi.fn() },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    kycService: { isConfigured: () => false, enforceThreshold: vi.fn(), getStatus: vi.fn() },
    ...partial,
  } as unknown as Container;
}

describe("admin session on buyer-gated POST routes", () => {
  it("POST /bids returns 403 bidding_not_allowed_for_role before bid service", async () => {
    const bidService = { placeBid: vi.fn() };
    const app = new Hono().route(
      "/bids",
      createBidRoutes(
        minimalContainer({
          bidService,
        }),
        adminAuth,
      ),
    );
    const res = await app.request("http://test/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId, amount: 100, maxAutoBidAmount: undefined }),
    });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "bidding_not_allowed_for_role" });
    expect(bidService.placeBid).not.toHaveBeenCalled();
  });

  it("POST /payments returns 403 bidding_not_allowed_for_role before payment service", async () => {
    const paymentService = { createPendingForWinner: vi.fn(), listAllForAdmin: vi.fn() };
    const app = new Hono().route(
      "/payments",
      createPaymentRoutes(
        minimalContainer({
          paymentService,
        }),
        adminAuth,
      ),
    );
    const res = await app.request("http://test/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId }),
    });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "bidding_not_allowed_for_role" });
    expect(paymentService.createPendingForWinner).not.toHaveBeenCalled();
  });

  it("POST /submissions/:id/submit returns 403 bidding_not_allowed_for_role before submission service", async () => {
    const itemSubmissionService = { submitForReview: vi.fn() };
    const app = new Hono().route(
      "/submissions",
      createSubmissionRoutes(
        minimalContainer({
          itemSubmissionService,
        }),
        adminAuth,
      ),
    );
    const res = await app.request(`http://test/submissions/${submissionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "bidding_not_allowed_for_role" });
    expect(itemSubmissionService.submitForReview).not.toHaveBeenCalled();
  });
});
