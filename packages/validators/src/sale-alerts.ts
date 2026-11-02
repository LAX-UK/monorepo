import { z } from "zod";

export const visitorAlertSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,60}$/)
    .optional(),
});

export const visitorAlertTokenSchema = z.object({
  token: z.string().min(1).max(2048),
});

export type VisitorAlertSignupInput = z.infer<typeof visitorAlertSignupSchema>;
