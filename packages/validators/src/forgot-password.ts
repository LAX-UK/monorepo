import { z } from "zod";

export const forgotPasswordBodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.trim().toLowerCase()),
  /** Required when the API has `TURNSTILE_SECRET_KEY` set. */
  turnstileToken: z.string().min(1).optional(),
});
