import { z } from "zod";
import { PADDLE_NUMBER_MIN } from "../paddle.js";

/** Buyer requests approval to bid on a sale using a chosen buyer legal entity. */
export const registerForSaleBodySchema = z.object({
  buyerLegalEntityId: z.string().uuid(),
  /** Optional paddle / per-sale bid ceiling (major currency units). */
  bidLimit: z.coerce.number().finite().positive().max(1e12).optional(),
});

export type RegisterForSaleBody = z.infer<typeof registerForSaleBodySchema>;

export const adminSaleRegistrationListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(),
});

export type AdminSaleRegistrationListQuery = z.infer<typeof adminSaleRegistrationListQuerySchema>;

export const adminSaleRegistrationParamsSchema = z.object({
  saleId: z.string().uuid(),
  registrationId: z.string().uuid(),
});

export type AdminSaleRegistrationParams = z.infer<typeof adminSaleRegistrationParamsSchema>;

export const adminRejectSaleRegistrationBodySchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const adminUpdateSaleRegistrationBidLimitBodySchema = z.object({
  bidLimit: z.union([z.coerce.number().finite().positive().max(1e12), z.null()]),
});

export type AdminUpdateSaleRegistrationBidLimitBody = z.infer<
  typeof adminUpdateSaleRegistrationBidLimitBodySchema
>;

/** Staff in-room check-in: approved registration + optional paddle assignment. */
export const adminSaleroomCheckInBodySchema = z.object({
  /** Better Auth user ids are opaque strings (not always UUID). */
  userId: z.string().min(1).max(191),
  buyerLegalEntityId: z.string().uuid(),
  /** When false, mark present without assigning a paddle (hybrid website-first). Default true. */
  assignPaddle: z.boolean().default(true),
  bidLimit: z.coerce.number().finite().positive().max(1e12).optional(),
  paddleNumber: z.coerce.number().int().min(PADDLE_NUMBER_MIN).optional(),
  laxNotes: z.string().max(2000).optional(),
});

export type AdminSaleroomCheckInBody = z.infer<typeof adminSaleroomCheckInBodySchema>;

export const adminSaleroomCheckInCandidatesQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
});

export type AdminSaleroomCheckInCandidatesQuery = z.infer<
  typeof adminSaleroomCheckInCandidatesQuerySchema
>;
