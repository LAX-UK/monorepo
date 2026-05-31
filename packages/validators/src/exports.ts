import {
  paymentStatuses,
  userEmailStatuses,
  userKycStatuses,
  userRoles,
  userStaffRoles,
} from "@auction/types";
import { z } from "zod";
import { listSubmissionsQuerySchema } from "./item-submission.js";
import { listLotsQuerySchema } from "./lot.js";
import { listSalesQuerySchema } from "./sale.js";
import {
  adminUserListPersonaFilterEnum,
  adminUserListSortEnum,
  adminUserListStatusEnum,
} from "./user.js";

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

const exportLotsFiltersSchema = listLotsQuerySchema.omit({ limit: true, offset: true }).extend({
  q: z.string().trim().max(200).optional(),
});

const exportSalesFiltersSchema = listSalesQuerySchema.omit({ limit: true, offset: true });

const exportSubmissionsFiltersSchema = listSubmissionsQuerySchema.omit({
  limit: true,
  offset: true,
});

const exportClientsIsoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const exportClientsFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  role: z.enum(userRoles).optional(),
  staffRole: z.enum(userStaffRoles).optional(),
  suspendedOnly: z.coerce.boolean().optional(),
  accountStatus: adminUserListStatusEnum.optional(),
  emailVerified: z.coerce.boolean().optional(),
  emailStatus: z.enum(userEmailStatuses).optional(),
  kycStatus: z.enum(userKycStatuses).optional(),
  kycStatuses: z.array(z.enum(userKycStatuses)).optional(),
  persona: adminUserListPersonaFilterEnum.optional(),
  twoFactorEnabled: z.coerce.boolean().optional(),
  deletionRequestedOnly: z.coerce.boolean().optional(),
  hasMobile: z.coerce.boolean().optional(),
  createdFrom: exportClientsIsoDateSchema.optional(),
  createdTo: exportClientsIsoDateSchema.optional(),
  kycVerifiedFrom: exportClientsIsoDateSchema.optional(),
  kycVerifiedTo: exportClientsIsoDateSchema.optional(),
  lastActiveFrom: exportClientsIsoDateSchema.optional(),
  lastActiveTo: exportClientsIsoDateSchema.optional(),
  sort: adminUserListSortEnum.optional(),
});

export type ExportClientsFilters = z.infer<typeof exportClientsFiltersSchema>;

const exportPaymentsFiltersSchema = z.object({
  status: z.enum(paymentStatuses).optional(),
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
    idempotencyKey: z.never().optional(),
  })
  .and(exportFiltersByEntitySchema);

export const exportPreviewBodySchema = exportFiltersByEntitySchema;

export const exportIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateExportBody = z.infer<typeof createExportBodySchema>;
export type ExportPreviewBody = z.infer<typeof exportPreviewBodySchema>;
