import { z } from "zod";
import { adminKpiTrendBundleSchema } from "./admin-kpi.js";

export const adminSaleOverviewKpiTrendsSchema = z.object({
  lots: adminKpiTrendBundleSchema,
  estimate: adminKpiTrendBundleSchema,
  hammer: adminKpiTrendBundleSchema,
  revenue: adminKpiTrendBundleSchema,
  registrations: adminKpiTrendBundleSchema,
  bidders: adminKpiTrendBundleSchema,
});

export type AdminSaleOverviewKpiTrendsDto = z.infer<typeof adminSaleOverviewKpiTrendsSchema>;
