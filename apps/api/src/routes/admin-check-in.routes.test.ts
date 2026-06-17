import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const SALE_ID = "00000000-0000-4000-8000-000000000002";
const USER_ID = "usr_8sK2xQ1aB9c";
const ENTITY_ID = "00000000-0000-4000-8000-0000000000e1";

function buildCheckInApp() {
  const checkInBidder = vi.fn().mockResolvedValue(
    ok({
      registrationId: "00000000-0000-4000-8000-0000000000a1",
      paddleNumber: 205,
      checkedInAt: new Date("2026-06-15T12:00:00.000Z"),
      bidLimit: "50000.00",
    }),
  );
  const searchCandidates = vi.fn().mockResolvedValue([
    {
      userId: USER_ID,
      name: "Jane",
      email: "jane@example.com",
      emailVerified: true,
      kycStatus: "approved",
      suspended: false,
      eligibleEntities: [],
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
    },
    telephoneBidBookingService: { countGlobalPending: vi.fn().mockResolvedValue(0) },
    onsiteEventRsvpService: { listAdminEvents: vi.fn().mockResolvedValue([]) },
    saleroomCheckInService: { checkInBidder, searchCandidates },
    redis: {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    },
  } as unknown as Container;

  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "clerk-1", role: "staff", staffRole: "super_admin" }),
  };

  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, checkInBidder, searchCandidates };
}

describe("saleroom check-in admin routes", () => {
  it("POST /admin/sales/:saleId/registrations/check-in", async () => {
    const { app, checkInBidder } = buildCheckInApp();
    const res = await app.request(`http://test/admin/sales/${SALE_ID}/registrations/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: USER_ID,
        buyerLegalEntityId: ENTITY_ID,
        bidLimit: 50000,
        paddleNumber: 205,
      }),
    });

    expect(res.status).toBe(200);
    expect(checkInBidder).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: SALE_ID,
        userId: USER_ID,
        buyerLegalEntityId: ENTITY_ID,
        decidedByUserId: "clerk-1",
        bidLimit: 50000,
        paddleNumber: 205,
      }),
    );
  });

  it("GET /admin/sales/:saleId/registrations/check-in-candidates", async () => {
    const { app, searchCandidates } = buildCheckInApp();
    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations/check-in-candidates?q=jane`,
    );

    expect(res.status).toBe(200);
    expect(searchCandidates).toHaveBeenCalledWith({ saleId: SALE_ID, q: "jane" });
    const json = (await res.json()) as { data?: { items?: unknown[] } };
    expect(json.data?.items?.length).toBe(1);
  });
});
