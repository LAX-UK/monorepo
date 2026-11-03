import { EMAIL_LIFT_REASONS } from "@auction/types";
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

/** Lifting a block: why, a note where the rule asks for one, and the block as the screen saw it. */
export const adminLiftEmailBlockBodySchema = z.object({
  reason: z.enum(EMAIL_LIFT_REASONS),
  note: z.string().trim().max(1000).optional(),
  writtenRequest: z.boolean().optional(),
  expectedSince: z.string().datetime({ offset: true }),
});
