import { z } from "zod";
import { registerPasswordPolicy } from "./password-policy.js";

/**
 * Signup persona — captured at registration to drive post-verify routing
 * (individual → /dashboard, organisation → /onboarding/organisation) and to
 * power the dashboard "finish setting up your organisation" CTAs (SE-P24).
 */
export const signupPersonaSchema = z.enum(["individual", "organisation"]);
export type SignupPersona = z.infer<typeof signupPersonaSchema>;

export const registerBodySchema = z
  .object({
    firstName: z
      .string()
      .min(1)
      .max(100)
      .transform((s) => s.trim()),
    lastName: z
      .string()
      .min(1)
      .max(100)
      .transform((s) => s.trim()),
    email: z
      .string()
      .email()
      .transform((e) => e.trim().toLowerCase()),
    password: z.string().min(12).max(128),
    persona: signupPersonaSchema,
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
    /** Required when the API has `TURNSTILE_SECRET_KEY` set. */
    turnstileToken: z.string().min(1).optional(),
  })
  .superRefine(registerPasswordPolicy);
