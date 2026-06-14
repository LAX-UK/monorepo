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

export const adminPaddlePlaceBidBodySchema = z.object({
  saleId: z.string().uuid(),
  lotId: z.string().uuid(),
  paddleNumber: z.coerce.number().int().min(PADDLE_NUMBER_MIN),
  amount: z.coerce.number().finite().positive().max(1e12),
  maxAutoBidAmount: z.coerce.number().finite().positive().max(1e12).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export type AdminPaddlePlaceBidBody = z.infer<typeof adminPaddlePlaceBidBodySchema>;
