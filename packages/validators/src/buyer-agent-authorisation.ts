import { z } from "zod";

/** Largest bid limit an organisation can set, in pounds (matches `numeric(18, 2)` headroom). */
export const BUYER_AGENT_BID_LIMIT_MAX = 1_000_000_000;

/**
 * Authorise a buyer-agent member to bid for the organisation: every sale (`saleId: null`) or one
 * sale, with an optional limit in pounds and an optional start and end. Dates are ISO strings.
 */
export const authoriseBuyerAgentSchema = z
  .object({
    memberUserId: z.string().min(1).max(200),
    saleId: z.string().uuid().nullable(),
    bidLimit: z.number().positive().max(BUYER_AGENT_BID_LIMIT_MAX).multipleOf(0.01).nullable(),
    validFrom: z.string().datetime({ offset: true }).nullable(),
    validUntil: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()
  .refine(
    (v) =>
      v.validFrom == null ||
      v.validUntil == null ||
      Date.parse(v.validUntil) > Date.parse(v.validFrom),
    { message: "The end must be after the start", path: ["validUntil"] },
  );

export type AuthoriseBuyerAgentInput = z.infer<typeof authoriseBuyerAgentSchema>;

/** Revoke an authorisation; the reason is kept with it and in the audit log. */
export const revokeBuyerAgentAuthorisationSchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();

export type RevokeBuyerAgentAuthorisationInput = z.infer<
  typeof revokeBuyerAgentAuthorisationSchema
>;
