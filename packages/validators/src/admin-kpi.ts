import { z } from "zod";

export const adminKpiPeriodDaysSchema = z.coerce
  .number()
  .int()
  .refine((n): n is 7 | 30 | 90 => n === 7 || n === 30 || n === 90, {
    message: "periodDays must be 7, 30, or 90",
  })
  .default(30);

export const adminKpiTrendBundleSchema = z.object({
  currentTotal: z.number().int().nonnegative(),
  priorTotal: z.number().int().nonnegative(),
  dailyCounts: z.array(z.number().int().nonnegative()),
});

export const adminKpiTrendQuerySchema = z.object({
  periodDays: adminKpiPeriodDaysSchema,
});

/** @deprecated Use adminKpiTrendQuerySchema — kept for existing route imports. */
export const adminLotsKpiTrendQuerySchema = adminKpiTrendQuerySchema;

export type AdminKpiTrendQuery = z.infer<typeof adminKpiTrendQuerySchema>;
export type AdminLotsKpiTrendQuery = AdminKpiTrendQuery;
export type AdminKpiTrendBundleDto = z.infer<typeof adminKpiTrendBundleSchema>;
