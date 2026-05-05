import { z } from "zod";

export const adminListOutboxQuerySchema = z.object({
  status: z.enum(["pending", "sending", "sent", "failed", "suppressed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminListEventsQuerySchema = z.object({
  messageId: z.string().min(1),
});

export const adminListSuppressionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const emailHashParamSchema = z.object({
  emailHash: z.string().min(16),
});
