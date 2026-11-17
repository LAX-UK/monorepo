import { z } from "zod";

export const PADDLE_NUMBER_MIN = 100;

export const adminPaddleAssignBodySchema = z.object({
  paddleNumber: z.coerce.number().int().min(PADDLE_NUMBER_MIN).optional(),
});

export type AdminPaddleAssignBody = z.infer<typeof adminPaddleAssignBodySchema>;

export const adminPaddleRegistrationParamsSchema = z.object({
  saleId: z.string().uuid(),
  registrationId: z.string().uuid(),
});

export type AdminPaddleRegistrationParams = z.infer<typeof adminPaddleRegistrationParamsSchema>;

export const adminSalePaddleRosterParamsSchema = z.object({
  saleId: z.string().uuid(),
});

export type AdminSalePaddleRosterParams = z.infer<typeof adminSalePaddleRosterParamsSchema>;

/**
 * The idempotency key of a bid staff place for a client (paddle or telephone), whether it comes in
 * the body or in the `Idempotency-Key` header. The same 8–128 rule applies to both, so a key the
 * API accepts always fits the refusal audit row's `request_key`.
 */
export const staffBidIdempotencyKeySchema = z.string().min(8).max(128);

/** The `Idempotency-Key` header on the staff bid routes (Hono lower-cases header names). */
export const staffBidIdempotencyHeaderSchema = z.object({
  "idempotency-key": staffBidIdempotencyKeySchema.optional(),
});

export const adminPaddlePlaceBidBodySchema = z.object({
  saleId: z.string().uuid(),
  lotId: z.string().uuid(),
  paddleNumber: z.coerce.number().int().min(PADDLE_NUMBER_MIN),
  amount: z.coerce.number().finite().positive().max(1e12),
  maxAutoBidAmount: z.coerce.number().finite().positive().max(1e12).optional(),
  idempotencyKey: staffBidIdempotencyKeySchema.optional(),
});

export type AdminPaddlePlaceBidBody = z.infer<typeof adminPaddlePlaceBidBodySchema>;
