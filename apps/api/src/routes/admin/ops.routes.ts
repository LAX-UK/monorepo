import {
  adminKpiTrendQuerySchema,
  adminSubmissionCountBySellersQuerySchema,
  adminSubmissionCountQuerySchema,
  adminWorkItemsQuerySchema,
} from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireAdminDashboard,
  requireFinanceAccess,
  requireSubmissionsAccess,
} from "../../middleware/require-capability.js";
import { LotAttentionNotFoundError } from "../../services/admin/admin-lot-attention.service.js";
import { SaleAttentionNotFoundError } from "../../services/admin/admin-sale-attention.service.js";
import type { AdminOpsMetricsRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminOpsRoutes(
  platform: AdminHono,
  container: AdminOpsMetricsRoutesContainer,
): void {
  platform.get("/submissions/quality-gaps-count", requireSubmissionsAccess, async (c) => {
    const count = await container.admin.ops.countQualityGapsForAdminApi();
    return c.json({ data: { count } });
  });

  platform.get(
    "/submissions/pending-count",
    requireSubmissionsAccess,
    zValidator("query", adminSubmissionCountQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const count = await container.admin.ops.countPendingSubmissions({
        status: q.status,
      });
      return c.json({ data: { count } });
    },
  );

  platform.get(
    "/submissions/count-by-sellers",
    requireSubmissionsAccess,
    zValidator("query", adminSubmissionCountBySellersQuerySchema),
    async (c) => {
      const { sellerIds } = c.req.valid("query");
      const count = await container.admin.ops.countSubmissionsBySellersForAdminApi(sellerIds);
      return c.json({ data: { count } });
    },
  );

  platform.get("/metrics/today", requireAdminDashboard, async (c) => {
    const data = await container.admin.ops.getTodayMetrics();
    return c.json({ data });
  });

  platform.get("/metrics/live", requireAdminDashboard, async (c) => {
    const bidsPerMinute = await container.admin.ops.getBidsPerMinute();
    return c.json({ data: { bidsPerMinute } });
  });

  platform.get("/nav-counts", requireAdminDashboard, async (c) => {
    const data = await container.admin.navCounts.getNavCounts();
    return c.json({ data });
  });

  platform.get(
    "/kpi/lots-hammer-trend",
    requireAdminDashboard,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.kpiTrends.getLotsHammerTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get(
    "/kpi/lots-ended-trend",
    requireAdminDashboard,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.kpiTrends.getLotsEndedTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get(
    "/kpi/lots-trend",
    requireAdminDashboard,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.kpiTrends.getLotsTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get(
    "/kpi/submissions-trend",
    requireSubmissionsAccess,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.kpiTrends.getSubmissionsTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get(
    "/kpi/payments-trend",
    requireFinanceAccess,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.kpiTrends.getPaymentsTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get(
    "/kpi/sales-trend",
    requireAdminDashboard,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.kpiTrends.getSalesTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get("/kpi/sales-summary", requireAdminDashboard, async (c) => {
    const data = await container.admin.listSummaries.getSalesListSummary();
    return c.json({ data });
  });

  platform.get("/kpi/lots-summary", requireAdminDashboard, async (c) => {
    const data = await container.admin.listSummaries.getLotsListSummary();
    return c.json({ data });
  });

  platform.get("/kpi/submissions-summary", requireSubmissionsAccess, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.admin.listSummaries.getSubmissionsListSummary(userId);
    return c.json({ data });
  });

  platform.get("/sales/:saleId/metrics", requireAdminDashboard, async (c) => {
    const saleId = c.req.param("saleId");
    const data = await container.admin.saleDetailBoard.getMetrics(saleId);
    return c.json({ data });
  });

  platform.get(
    "/sales/:saleId/kpi-trends",
    requireAdminDashboard,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const saleId = c.req.param("saleId");
      const q = c.req.valid("query");
      const data = await container.admin.saleDetailBoard.getOverviewKpiTrends(saleId, q.periodDays);
      if (!data) {
        return c.json({ error: "not_found" }, 404);
      }
      return c.json({ data });
    },
  );

  platform.get("/sales/:saleId/attention", requireAdminDashboard, async (c) => {
    const saleId = c.req.param("saleId");
    const role = (c.get("userRole") ?? "client") as "client" | "staff" | "seller";
    const staffRole = c.get("userStaffRole") ?? null;
    try {
      const data = await container.admin.saleDetailBoard.getAttention(saleId, {
        role,
        staffRole,
      });
      return c.json({ data });
    } catch (err) {
      if (err instanceof SaleAttentionNotFoundError) {
        return c.json({ error: "not_found" }, 404);
      }
      throw err;
    }
  });

  platform.get("/lots/:lotId/metrics", requireAdminDashboard, async (c) => {
    const lotId = c.req.param("lotId");
    const data = await container.admin.lotDetailBoard.getMetrics(lotId);
    if (!data) {
      return c.json({ error: "not_found" }, 404);
    }
    return c.json({ data });
  });

  platform.get(
    "/lots/:lotId/overview-kpi-trends",
    requireAdminDashboard,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const lotId = c.req.param("lotId");
      const q = c.req.valid("query");
      const data = await container.admin.lotDetailBoard.getOverviewKpiTrends(lotId, q.periodDays);
      if (!data) {
        return c.json({ error: "not_found" }, 404);
      }
      return c.json({ data });
    },
  );

  platform.get("/lots/:lotId/attention", requireAdminDashboard, async (c) => {
    const lotId = c.req.param("lotId");
    const role = (c.get("userRole") ?? "client") as "client" | "staff" | "seller";
    const staffRole = c.get("userStaffRole") ?? null;
    try {
      const data = await container.admin.lotDetailBoard.getAttention(lotId, {
        role,
        staffRole,
      });
      return c.json({ data });
    } catch (err) {
      if (err instanceof LotAttentionNotFoundError) {
        return c.json({ error: "not_found" }, 404);
      }
      throw err;
    }
  });

  platform.get(
    "/kpi/payouts-trend",
    requireFinanceAccess,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.kpiTrends.getPayoutsTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get(
    "/work-items",
    requireAdminDashboard,
    zValidator("query", adminWorkItemsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as import("@auction/types").UserRole;
      const staffRole = c.get("userStaffRole") as import("@auction/types").UserStaffRole | null;
      const data = await container.admin.workItems.listWorkItems({
        actorUserId: userId,
        actorRole: role,
        actorStaffRole: staffRole,
        query: q,
      });
      return c.json({ data });
    },
  );
}

export function attachAdminAttentionRoutes(
  platform: AdminHono,
  container: AdminOpsMetricsRoutesContainer,
): void {
  platform.get("/attention", requireAdminDashboard, async (c) => {
    const data = await container.admin.ops.listAttentionFeed();
    return c.json({ data });
  });
}
