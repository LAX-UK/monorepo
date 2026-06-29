import {
  adminAnalyticsQuerySchema,
  adminConveyorPipelineQuerySchema,
  adminKpiTrendQuerySchema,
  adminSubmissionCountBySellersQuerySchema,
  adminSubmissionCountQuerySchema,
} from "@auction/validators";
import type { Container } from "../../container.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireAdminDashboard,
  requireAnalytics,
  requireFinanceAccess,
  requireOperationsFulfilment,
  requireSubmissionsAccess,
} from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminOpsRoutes(platform: AdminHono, container: Container): void {
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

  /** Seller intake → catalogue → live: submissions joined to converted lots (recent first). */
  platform.get(
    "/conveyor-pipeline",
    requireOperationsFulfilment,
    zValidator("query", adminConveyorPipelineQuerySchema),
    async (c) => {
      const { limit } = c.req.valid("query");
      const data = await container.admin.ops.listConveyorPipeline(limit);
      return c.json({ data });
    },
  );

  platform.get(
    "/analytics",
    requireAnalytics,
    zValidator("query", adminAnalyticsQuerySchema),
    async (c) => {
      const { days } = c.req.valid("query");
      const end = new Date();
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - days);
      const data = await container.admin.ops.getAnalyticsDashboard({ start, end });
      return c.json({ data });
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
    const data = await container.admin.dashboardMetrics.getNavCounts();
    return c.json({ data });
  });

  platform.get(
    "/kpi/lots-trend",
    requireAdminDashboard,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.dashboardMetrics.getLotsTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get(
    "/kpi/payments-trend",
    requireFinanceAccess,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.dashboardMetrics.getPaymentsTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get(
    "/kpi/sales-trend",
    requireAdminDashboard,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.dashboardMetrics.getSalesTrend(q.periodDays);
      return c.json({ data });
    },
  );

  platform.get(
    "/kpi/payouts-trend",
    requireFinanceAccess,
    zValidator("query", adminKpiTrendQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.dashboardMetrics.getPayoutsTrend(q.periodDays);
      return c.json({ data });
    },
  );
}

export function attachAdminAttentionRoutes(platform: AdminHono, container: Container): void {
  platform.get("/attention", requireAdminDashboard, async (c) => {
    const data = await container.admin.ops.listAttentionFeed();
    return c.json({ data });
  });
}
