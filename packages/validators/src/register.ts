import { z } from "zod";
import { phoneCountrySchema, phoneInputSchema } from "./mobile.js";
import { registerPasswordPolicy } from "./password-policy.js";
import { resolvePhoneFromBody } from "./phone/resolve.js";

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
    phone: phoneInputSchema.optional(),
    /** @deprecated Prefer `phone`. */
    mobile: z.string().trim().max(32).optional(),
    mobileCountry: phoneCountrySchema.optional(),
    /** Required when the API has `TURNSTILE_SECRET_KEY` set. */
    turnstileToken: z.string().min(1).optional(),
  })
  .superRefine(registerPasswordPolicy)
  .superRefine((data, ctx) => {
    const r = resolvePhoneFromBody(data);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.message, path: r.path });
    }
  })
  .transform((data) => {
    const r = resolvePhoneFromBody(data);
    const { phone: _phone, mobile: _legacy, mobileCountry: _legacyCc, ...rest } = data;
    if (!r.ok || !r.value) return rest;
    return {
      ...rest,
      mobile: r.value.e164,
      mobileCountry: r.value.country,
    };
  });
