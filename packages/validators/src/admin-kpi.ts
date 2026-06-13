import { z } from "zod";

export const adminKpiPeriodDaysSchema = z.coerce
  .number()
  .int()
  .refine((n): n is 7 | 30 | 90 => n === 7 || n === 30 || n === 90, {
    message: "periodDays must be 7, 30, or 90",
  })
  .default(30);

export const adminLotsKpiTrendQuerySchema = z.object({
  periodDays: adminKpiPeriodDaysSchema,
});

export type AdminLotsKpiTrendQuery = z.infer<typeof adminLotsKpiTrendQuerySchema>;
