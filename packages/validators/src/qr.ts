import { z } from "zod";

export const qrCodeEntityTypes = ["sale", "lot"] as const;
export const qrCodeStatuses = ["active", "disabled"] as const;

export const qrShortCodeSchema = z
  .string()
  .min(6)
  .max(12)
  .regex(/^[0-9A-Za-z]+$/, "Short code must be Base62");

export const qrShortCodeParamSchema = z.object({
  shortCode: qrShortCodeSchema,
});

export const adminQrCodeIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const adminQrCodeEntityQuerySchema = z.object({
  entityType: z.enum(qrCodeEntityTypes),
  entityId: z.string().uuid(),
});

export const adminQrCodeCreateSchema = z.object({
  entityType: z.enum(qrCodeEntityTypes),
  entityId: z.string().uuid(),
  campaign: z.string().trim().max(120).optional(),
  placement: z.string().trim().max(120).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const adminQrCodeRegenerateSchema = z.object({
  entityType: z.enum(qrCodeEntityTypes),
  entityId: z.string().uuid(),
});

export const adminQrCodeUpdateSchema = z.object({
  campaign: z.string().trim().max(120).nullable().optional(),
  placement: z.string().trim().max(120).nullable().optional(),
  status: z.enum(qrCodeStatuses).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const adminQrCodeAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type AdminQrCodeCreateInput = z.infer<typeof adminQrCodeCreateSchema>;
export type AdminQrCodeRegenerateInput = z.infer<typeof adminQrCodeRegenerateSchema>;
export type AdminQrCodeUpdateInput = z.infer<typeof adminQrCodeUpdateSchema>;
export type AdminQrCodeEntityQuery = z.infer<typeof adminQrCodeEntityQuerySchema>;
