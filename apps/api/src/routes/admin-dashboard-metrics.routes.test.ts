import type { IAdminWorkItemsReader } from "@auction/persistence/interfaces";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { AdminWorkItemsService } from "../services/admin/admin-work-items.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";

type NavCountsMock = Partial<Container["admin"]["navCounts"]>;
type KpiTrendsMock = Partial<Container["admin"]["kpiTrends"]>;
type ListSummariesMock = Partial<Container["admin"]["listSummaries"]>;
type SaleDetailBoardMock = Partial<Container["admin"]["saleDetailBoard"]>;
type WorkItemsMock = Partial<Container["admin"]["workItems"]>;

function createDashboardMetricsContainer(
  navCounts: NavCountsMock,
  kpiTrends: KpiTrendsMock = {},
  listSummaries: ListSummariesMock = {},
  saleDetailBoard: SaleDetailBoardMock = {},
  workItems: WorkItemsMock = {},
) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      navCounts,
      kpiTrends,
      listSummaries,
      workItems,
      saleDetailBoard: {
        getMetrics: vi.fn(),
        getAttention: vi.fn(),
        getOverviewKpiTrends: vi.fn(),
        ...saleDetailBoard,
      },
      lotDetailBoard: {
        getMetrics: vi.fn(),
        getAttention: vi.fn(),
        getOverviewKpiTrends: vi.fn(),
      },
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
    const container = createDashboardMetricsContainer({ getNavCounts });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/nav-counts");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof navCounts };
    expect(body.data).toEqual(navCounts);
    expect(getNavCounts).toHaveBeenCalledOnce();
  });

  it("GET /kpi/submissions-trend returns trend bundle for authorized staff", async () => {
    const trend = { currentTotal: 5, priorTotal: 3, dailyCounts: [1, 2] };
    const getSubmissionsTrend = vi.fn().mockResolvedValue(trend);
    const container = createDashboardMetricsContainer({}, { getSubmissionsTrend });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "catalogue_manager",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/kpi/submissions-trend?periodDays=7");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof trend };
    expect(body.data).toEqual(trend);
    expect(getSubmissionsTrend).toHaveBeenCalledWith(7);
  });

  it("GET /kpi/lots-trend returns trend bundle for authorized staff", async () => {
    const trend = { currentTotal: 10, priorTotal: 8, dailyCounts: [1, 2, 3] };
    const getLotsTrend = vi.fn().mockResolvedValue(trend);
    const container = createDashboardMetricsContainer({}, { getLotsTrend });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/kpi/lots-trend?periodDays=7");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof trend };
    expect(body.data).toEqual(trend);
    expect(getLotsTrend).toHaveBeenCalledWith(7);
  });

  it("GET /kpi/lots-ended-trend returns ended trend bundle for authorized staff", async () => {
    const trend = { currentTotal: 4, priorTotal: 2, dailyCounts: [0, 1, 2] };
    const getLotsEndedTrend = vi.fn().mockResolvedValue(trend);
    const container = createDashboardMetricsContainer({}, { getLotsEndedTrend });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/kpi/lots-ended-trend?periodDays=30");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof trend };
    expect(body.data).toEqual(trend);
    expect(getLotsEndedTrend).toHaveBeenCalledWith(30);
  });

  it("GET /kpi/lots-hammer-trend returns hammer trend bundle for authorized staff", async () => {
    const trend = {
      currentTotal: 45000,
      priorTotal: 38000,
      dailyCounts: [1000, 2000, 3000],
    };
    const getLotsHammerTrend = vi.fn().mockResolvedValue(trend);
    const container = createDashboardMetricsContainer({}, { getLotsHammerTrend });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/kpi/lots-hammer-trend?periodDays=30");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof trend };
    expect(body.data).toEqual(trend);
    expect(getLotsHammerTrend).toHaveBeenCalledWith(30);
  });

  it("GET /kpi/sales-summary returns aggregate sales KPIs for authorized staff", async () => {
    const summary = {
      activeCount: 3,
      upcomingCount: 2,
      draftCount: 1,
      completedCount: 10,
      avgLotsPerSale: 12.5,
      totalHammerValue: "45000",
      lensCounts: {
        all: 16,
        upcoming: 2,
        live: 3,
        closed: 4,
        settled: 10,
        setup: 1,
      },
    };
    const getSalesListSummary = vi.fn().mockResolvedValue(summary);
    const container = createDashboardMetricsContainer({}, {}, { getSalesListSummary });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/kpi/sales-summary");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof summary };
    expect(body.data).toEqual(summary);
    expect(getSalesListSummary).toHaveBeenCalledOnce();
  });

  it("GET /kpi/lots-summary returns aggregate lots KPIs for authorized staff", async () => {
    const summary = {
      liveCount: 12,
      draftCount: 5,
      endingSoonCount: 3,
      needsAttentionCount: 4,
      endedCount: 8,
      publishedCount: 95,
      totalHammerValue: "125000.00",
      lensCounts: {
        all: 100,
        live: 12,
        draft: 5,
        ending: 3,
        attention: 4,
      },
    };
    const getLotsListSummary = vi.fn().mockResolvedValue(summary);
    const container = createDashboardMetricsContainer({}, {}, { getLotsListSummary });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/kpi/lots-summary");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof summary };
    expect(body.data).toEqual(summary);
    expect(getLotsListSummary).toHaveBeenCalledOnce();
  });

  it("GET /sales/:saleId/metrics returns sale detail KPIs for authorized staff", async () => {
    const metrics = {
      lotCount: 15,
      publishedLotCount: 16,
      aggregateEstimate: "125000",
      aggregateEstimateDeltaHint: "8 lots priced",
      expectedRevenue: "125000",
      expectedRevenueHint: "Incl. buyer's premium",
      activeBidders: 4,
      activeBiddersHint: "Bidding in session",
      bidActivityOnline: 12,
      bidActivityRoom: 3,
      bidActivityPhone: 1,
      lastCatalogueSyncLabel: null,
      lastExportLabel: null,
      lastStatusChangeLabel: null,
    };
    const getMetrics = vi.fn().mockResolvedValue(metrics);
    const container = createDashboardMetricsContainer({}, {}, {}, { getMetrics });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/sales/sale-1/metrics");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof metrics };
    expect(body.data).toEqual(metrics);
    expect(getMetrics).toHaveBeenCalledWith("sale-1");
  });

  it("GET /sales/:saleId/attention returns sale attention for authorized staff", async () => {
    const attention = {
      items: [
        {
          id: "pending-regs",
          kind: "pending_registrations",
          category: "Bidders",
          severity: "critical",
          count: 2,
          target: { tab: "registrations" },
        },
      ],
      totalCount: 1,
      truncated: false,
    };
    const getAttention = vi.fn().mockResolvedValue(attention);
    const container = createDashboardMetricsContainer({}, {}, {}, { getAttention });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/sales/sale-1/attention");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof attention };
    expect(body.data).toEqual(attention);
    expect(getAttention).toHaveBeenCalledWith("sale-1", {
      role: "staff",
      staffRole: "super_admin",
    });
  });

  it("GET /sales/:saleId/attention returns 404 when sale is missing", async () => {
    const { SaleAttentionNotFoundError } = await import(
      "../services/admin/admin-sale-attention.service.js"
    );
    const getAttention = vi.fn().mockRejectedValue(new SaleAttentionNotFoundError("missing-sale"));
    const container = createDashboardMetricsContainer({}, {}, {}, { getAttention });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/sales/missing-sale/attention");

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("GET /sales/:saleId/kpi-trends returns trend bundles for authorized staff", async () => {
    const trends = {
      lots: { currentTotal: 2, priorTotal: 1, dailyCounts: [1, 1] },
      estimate: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0] },
      hammer: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0] },
      revenue: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0] },
      registrations: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0] },
      bidders: { currentTotal: 0, priorTotal: 0, dailyCounts: [0, 0] },
    };
    const getOverviewKpiTrends = vi.fn().mockResolvedValue(trends);
    const container = createDashboardMetricsContainer({}, {}, {}, { getOverviewKpiTrends });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/sales/sale-1/kpi-trends?periodDays=30");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof trends };
    expect(body.data).toEqual(trends);
    expect(getOverviewKpiTrends).toHaveBeenCalledWith("sale-1", 30);
  });

  it("GET /sales/:saleId/kpi-trends returns 404 when sale is missing", async () => {
    const getOverviewKpiTrends = vi.fn().mockResolvedValue(null);
    const container = createDashboardMetricsContainer({}, {}, {}, { getOverviewKpiTrends });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/sales/missing-sale/kpi-trends?periodDays=30");

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("GET /work-items returns inbox payload for authorized staff", async () => {
    const payload = {
      items: [
        {
          id: "payment:pay-1",
          kind: "payment_manual_review" as const,
          domain: "finance" as const,
          title: "Payment manual review",
          subtitle: null,
          href: "/admin/payments/pay-1",
          saleId: null,
          createdAt: "2026-07-27T10:00:00.000Z",
          sourceUpdatedAt: "2026-07-27T10:00:00.000Z",
          dueAt: null,
          severity: "critical" as const,
          assignedToUserId: null,
          actions: ["capture", "refund"] as const,
        },
      ],
      nextCursor: null,
      counts: {
        total: 1,
        urgent: 1,
        byDomain: {
          finance: 1,
          compliance: 0,
          catalogue: 0,
          saleroom: 0,
          fulfilment: 0,
          clients: 0,
        },
      },
    };
    const listWorkItems = vi.fn().mockResolvedValue(payload);
    const container = createDashboardMetricsContainer({}, {}, {}, {}, { listWorkItems });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: staffUserId,
        role: "staff",
        staffRole: "super_admin",
      }),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/work-items?limit=10");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof payload };
    expect(body.data).toEqual(payload);
    expect(listWorkItems).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: staffUserId,
        query: expect.objectContaining({ limit: 10 }),
      }),
    );
  });

  it("GET /work-items returns 403 for non-staff users", async () => {
    const listWorkItems = vi.fn();
    const container = createDashboardMetricsContainer({}, {}, {}, {}, { listWorkItems });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "client-1", role: "client", staffRole: null }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/work-items");

    expect(res.status).toBe(403);
    expect(listWorkItems).not.toHaveBeenCalled();
  });

  it("GET /work-items does not leak compliance rows to catalogue staff", async () => {
    const empty = vi.fn().mockResolvedValue([]);
    const reader: IAdminWorkItemsReader = {
      listManualReviewPayments: vi.fn().mockResolvedValue([]),
      listPendingReviewTasks: vi.fn().mockResolvedValue([
        {
          sourceId: "aml-1",
          kind: "aml_screening",
          domain: "compliance",
          title: "AML review",
          subtitle: null,
          href: "/admin/compliance/aml/aml-1",
          saleId: null,
          createdAt: new Date("2026-07-27T10:00:00.000Z"),
          sourceUpdatedAt: new Date("2026-07-27T10:00:00.000Z"),
          assignedToUserId: null,
        },
      ]),
      listSubmissionReviews: empty,
      listConditionReports: empty,
      listLotFulfilment: empty,
      listPendingRegistrations: empty,
      listPendingTelephoneBookings: empty,
      listDraftLotsPastStart: empty,
    };
    const workItems = new AdminWorkItemsService(reader);
    const container = createDashboardMetricsContainer({}, {}, {}, {}, workItems);
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "catalogue-1",
        role: "staff",
        staffRole: "catalogue_manager",
      }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/work-items");
    const body = (await res.json()) as { data: { items: unknown[] } };

    expect(res.status).toBe(200);
    expect(body.data.items).toEqual([]);
    expect(reader.listPendingReviewTasks).not.toHaveBeenCalled();
  });

  it("GET /nav-counts returns 401 when unauthenticated", async () => {
    const container = createDashboardMetricsContainer({
      getNavCounts: vi.fn(),
    });

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue(null),
    };

    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/nav-counts");

    expect(res.status).toBe(401);
  });
});
