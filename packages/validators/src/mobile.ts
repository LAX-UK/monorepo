import { z } from "zod";
import { isValidCountryCode } from "./phone/countries.js";
import type { NormalizedPhone } from "./phone/normalize.js";
import type { PhoneInputValues } from "./phone/resolve.js";

export type { PhoneInputValues };

export type StoredPhone = NormalizedPhone;

export const phoneCountrySchema = z
  .string()
  .trim()
  .length(2)
  .transform((s) => s.toUpperCase())
  .refine(isValidCountryCode, { message: "Select a valid country" });

export const phoneInputSchema = z.object({
  country: phoneCountrySchema,
  number: z.string().trim().max(32),
});

/** RHF phone block (optional — empty number is allowed at form level; clear via action). */
export const profilePhoneFormSchema = z.object({
  phone: phoneInputSchema,
});

export type ProfilePhoneFormValues = z.infer<typeof profilePhoneFormSchema>;

export const emptyProfilePhoneFormValues = (defaultCountry = "GB"): ProfilePhoneFormValues => ({
  phone: { country: defaultCountry, number: "" },
});
