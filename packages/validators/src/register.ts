import { z } from "zod";

/**
 * Signup persona — captured at registration to drive post-verify routing
 * (individual → /dashboard, organisation → /onboarding/organisation) and to
 * power the dashboard "finish setting up your organisation" CTAs (SE-P24).
 */
export const signupPersonaSchema = z.enum(["individual", "organisation"]);
export type SignupPersona = z.infer<typeof signupPersonaSchema>;

export const registerBodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
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
});
