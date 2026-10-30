import { z } from "zod";

/** A page of sold lots, optionally one calendar year. */
export const soldLotsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type SoldLotsQuery = z.infer<typeof soldLotsQuerySchema>;

export const payoutDetailParamSchema = z.object({ payoutId: z.string().uuid() });

/** A page of works that came back unsold. */
export const returnedWorksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const submissionAgreementParamSchema = z.object({ submissionId: z.string().uuid() });
