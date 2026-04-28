import { z } from "zod";

export const registerBodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  /** When present, signup assigns the invited role after successful account creation. */
  inviteToken: z.string().min(16).max(512).optional(),
  mobile: z
    .string()
    .trim()
    .max(32)
    .optional()
    .refine((v) => v === undefined || v.length === 0 || v.length >= 6, {
      message: "Mobile must be at least 6 characters when provided",
    })
    .transform((v) => (v === undefined || v.length === 0 ? undefined : v)),
});
