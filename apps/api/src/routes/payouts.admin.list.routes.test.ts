import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminPayoutRoutes } from "./payouts.js";

function mountApp() {
  const app = new Hono();
  const payouts = {
    adminListPage: vi.fn(),
    adminSettlementPreview: vi.fn(),
    adminManualReverse: vi.fn(),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    admin: { payouts },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "u1",
      role: "staff",
      staffRole: "finance_ops",
      scopes: ["bid.read"],
    }),
  };
  app.route("/admin/payouts", createAdminPayoutRoutes(container, authenticator));
  return { app, payouts };
}

describe("admin payout routes — list page", () => {
  it("returns paginated rows with summary meta", async () => {
    const { app, payouts } = mountApp();
    payouts.adminListPage.mockResolvedValue({
      rows: [{ id: "p1", status: "scheduled" }],
      total: 1,
      offset: 0,
      limit: 25,
      summary: {
        total: 1,
        scheduled: 1,
        inTransit: 0,
        paid: 0,
        failed: 0,
        reversed: 0,
        clawbackPending: 0,
        totalNet: "88.00",
        readiness: {
          inFlightCount: 1,
          missingTransferRefCount: 1,
          withFailureReasonCount: 0,
          withStatementErrorCount: 0,
          clawbackCount: 0,
          failedCount: 0,
          reversedCount: 0,
          blockerPayoutCount: 0,
        },
      },
    });

    const res = await app.request("/admin/payouts?limit=25&offset=0");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: unknown[];
      meta: { total: number; summary: { scheduled: number } };
    };
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(body.meta.summary.scheduled).toBe(1);
  });
});
