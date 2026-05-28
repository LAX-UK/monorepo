import { listLotsQuerySchema } from "./lot.js";
import { listSalesQuerySchema } from "./sale.js";
import { listSubmissionsQuerySchema } from "./item-submission.js";
import { z } from "zod";

const aggregateTypeField = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9._-]+$/, "Invalid aggregate type");
const aggregateIdField = z.string().min(1).max(191);

export const exportEntityTypeSchema = z.enum([
  "lots",
  "sales",
  "submissions",
  "clients",
  "payments",
  "domain-events",
  "payouts",
  "analytics",
]);
export const exportFormatSchema = z.enum(["csv"]);

const exportLotsFiltersSchema = listLotsQuerySchema
  .omit({ limit: true, offset: true })
  .extend({
    q: z.string().trim().max(200).optional(),
  });

const exportSalesFiltersSchema = listSalesQuerySchema.omit({ limit: true, offset: true });

const exportSubmissionsFiltersSchema = listSubmissionsQuerySchema.omit({ limit: true, offset: true });

const exportClientsFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  role: z.string().optional(),
  staffRole: z.string().optional(),
  suspendedOnly: z.coerce.boolean().optional(),
});

const exportPaymentsFiltersSchema = z.object({
  status: z.string().optional(),
  manualReview: z.coerce.boolean().optional(),
});

const exportDomainEventsFiltersSchema = z
  .object({
    aggregateType: aggregateTypeField.optional(),
    aggregateId: aggregateIdField.optional(),
    includePii: z.coerce.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const at = data.aggregateType?.trim() ?? "";
    const aid = data.aggregateId?.trim() ?? "";
    const hasHalf = at.length > 0 !== aid.length > 0;
    if (hasHalf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "aggregateType and aggregateId must both be set together",
        path: ["aggregateId"],
      });
    }
  });

const exportAnalyticsFiltersSchema = z.object({
  days: z.coerce.number().int().min(1).max(365),
  series: z.enum(["revenue", "ended_lots", "registrations"]),
});

export const exportFiltersByEntitySchema = z.discriminatedUnion("entityType", [
  z.object({ entityType: z.literal("lots"), filters: exportLotsFiltersSchema.default({}) }),
  z.object({ entityType: z.literal("sales"), filters: exportSalesFiltersSchema.default({}) }),
  z.object({
    entityType: z.literal("submissions"),
    filters: exportSubmissionsFiltersSchema.default({}),
  }),
  z.object({ entityType: z.literal("clients"), filters: exportClientsFiltersSchema.default({}) }),
  z.object({ entityType: z.literal("payments"), filters: exportPaymentsFiltersSchema.default({}) }),
  z.object({
    entityType: z.literal("domain-events"),
    filters: exportDomainEventsFiltersSchema.default({}),
  }),
  z.object({
    entityType: z.literal("payouts"),
    filters: z.object({ legalEntityId: z.string().uuid().optional() }).default({}),
  }),
  z.object({
    entityType: z.literal("analytics"),
    filters: exportAnalyticsFiltersSchema,
  }),
]);

export const createExportBodySchema = z
  .object({
    format: exportFormatSchema.default("csv"),
    forceAsync: z.boolean().optional(),
    idempotencyKey: z.string().trim().max(128).optional(),
  })
  .and(exportFiltersByEntitySchema);

export const exportPreviewBodySchema = exportFiltersByEntitySchema;

export const exportIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateExportBody = z.infer<typeof createExportBodySchema>;
export type ExportPreviewBody = z.infer<typeof exportPreviewBodySchema>;
