import { z } from "zod";
import { phoneCountrySchema, phoneInputSchema } from "./mobile.js";
import { resolvePhoneFromBody } from "./phone/resolve.js";
import { signupPersonaSchema } from "./register.js";

/** Legal terms version recorded when the user accepts Conditions of Business on Bid. */
export const BID_TERMS_VERSION = "conditions-of-business-2026";

/** Normalized onboarding payload after zod validation (phone fields optional). */
export type AccountOnboardingSubmitBody = {
  firstName: string;
  lastName: string;
  persona: z.infer<typeof signupPersonaSchema>;
  inviteToken?: string;
  mobile?: string;
  mobileCountry?: string;
};

export const accountOnboardingBodySchema = z
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
    persona: signupPersonaSchema,
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: "You must accept the Conditions of Business",
    }),
    inviteToken: z.string().min(16).max(512).optional(),
    phone: phoneInputSchema.optional(),
    mobile: z.string().trim().max(32).optional(),
    mobileCountry: phoneCountrySchema.optional(),
    turnstileToken: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    const r = resolvePhoneFromBody(data);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.message, path: r.path });
    }
  })
  .transform((data): AccountOnboardingSubmitBody => {
    const r = resolvePhoneFromBody(data);
    const {
      phone: _phone,
      mobile: _legacy,
      mobileCountry: _legacyCc,
      acceptTerms: _terms,
      turnstileToken: _turnstile,
      ...rest
    } = data;
    if (!r.ok || !r.value) {
      return {
        firstName: rest.firstName,
        lastName: rest.lastName,
        persona: rest.persona,
        ...(rest.inviteToken !== undefined ? { inviteToken: rest.inviteToken } : {}),
      };
    }
    return {
      firstName: rest.firstName,
      lastName: rest.lastName,
      persona: rest.persona,
      ...(rest.inviteToken !== undefined ? { inviteToken: rest.inviteToken } : {}),
      mobile: r.value.e164,
      mobileCountry: r.value.country,
    };
  });

export const accountOnboardingClientFormSchema = z
  .object({
    firstName: z
      .string()
      .min(1, "First name is required")
      .max(100)
      .transform((s) => s.trim()),
    lastName: z
      .string()
      .min(1, "Last name is required")
      .max(100)
      .transform((s) => s.trim()),
    persona: signupPersonaSchema,
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: "You must accept the Conditions of Business",
    }),
    phone: phoneInputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const r = resolvePhoneFromBody(data);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.message, path: r.path });
    }
  });

export function isAccountOnboardingComplete(input: {
  termsAcceptedAt: Date | string | null | undefined;
}): boolean {
  return input.termsAcceptedAt != null;
}
