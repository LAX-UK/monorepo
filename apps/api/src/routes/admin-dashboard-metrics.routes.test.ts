import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";

function createDashboardMetricsContainer(dashboardMetrics: Container["admin"]["dashboardMetrics"]) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      dashboardMetrics,
    },
  } as unknown as Container;
}

describe("admin dashboard metrics routes", () => {
  it("GET /nav-counts returns badge counts for authorized staff", async () => {
    const navCounts = {
      submissionsPending: 2,
      artistsPending: 0,
      conditionReportsPending: 1,
      manualReviewCount: 0,
      onboardingIssuesTotal: 3,
      lotFulfilmentPending: 0,
      withdrawalsPending: 0,
      disputesOpen: 0,
      payoutsFailed: 0,
      saleroomLiveCount: 1,
      invitationsPending: 0,
      draftSalesNeedingSetup: 0,
      draftLotsMissingPhotos: 0,
      amlScreeningsPending: 0,
      sourceOfFundsPending: 0,
      telephoneBookingsPending: 0,
      legalEntityStripeRequirementsCount: 0,
    };
    const getNavCounts = vi.fn().mockResolvedValue(navCounts);
    const container = createDashboardMetricsContainer({ getNavCounts } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "super_admin" }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/nav-counts");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof navCounts };
    expect(body.data).toEqual(navCounts);
    expect(getNavCounts).toHaveBeenCalledOnce();
  });

  it("GET /kpi/lots-trend returns trend bundle for authorized staff", async () => {
    const trend = { currentTotal: 10, priorTotal: 8, dailyCounts: [1, 2, 3] };
    const getLotsTrend = vi.fn().mockResolvedValue(trend);
    const container = createDashboardMetricsContainer({ getLotsTrend } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "super_admin" }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/kpi/lots-trend?periodDays=7");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof trend };
    expect(body.data).toEqual(trend);
    expect(getLotsTrend).toHaveBeenCalledWith(7);
  });

  it("GET /nav-counts returns 401 when unauthenticated", async () => {
    const container = createDashboardMetricsContainer({
      getNavCounts: vi.fn(),
    } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue(null),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/nav-counts");

    expect(res.status).toBe(401);
  });
});
