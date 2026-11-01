import { ACTIVITY_GROUPS } from "@auction/domain";
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable();

/** The address printed on invoices: complete, or absent. */
const invoiceAddressSchema = z
  .object({
    line1: z.string().trim().min(1).max(200),
    line2: optionalText(200),
    city: z.string().trim().min(1).max(100),
    region: optionalText(100),
    postalCode: z.string().trim().min(1).max(20),
    /** ISO 3166-1 alpha-2. */
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase()),
  })
  .strict();

/**
 * `PUT /legal-entities/invoice-details`: the whole set, so a cleared field is cleared. An empty
 * string means "none".
 */
export const updateInvoiceDetailsSchema = z
  .object({
    billingEmail: z
      .string()
      .trim()
      .max(254)
      .transform((value) => (value.length > 0 ? value.toLowerCase() : null))
      .pipe(z.string().email().nullable())
      .nullable(),
    address: invoiceAddressSchema.nullable(),
    poReference: optionalText(60),
  })
  .strict();

export type UpdateInvoiceDetailsInput = z.infer<typeof updateInvoiceDetailsSchema>;

/** Digits, spaces and the usual phone punctuation, with 6 to 15 digits (E.164 allows 15). */
const PHONE = /^\+?[0-9 ().-]+$/;
const phoneDigits = (value: string) => value.replace(/\D/g, "").length;

/** A web address: `https://` is added when no scheme is given; only http and https are kept. */
function websiteUrl(value: string): string | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") || url.username || url.password) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const emptyToNull = (value: string) => (value.length > 0 ? value : null);

/**
 * `PUT /legal-entities/contact-details`: the whole set, so a cleared field is cleared. An empty
 * string means "none".
 */
export const updateContactDetailsSchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254)
      .transform((value) => emptyToNull(value.toLowerCase()))
      .pipe(z.string().email("Enter an email address like name@example.com").nullable())
      .nullable(),
    phone: z
      .string()
      .trim()
      .max(30)
      .transform(emptyToNull)
      .pipe(
        z
          .string()
          .regex(PHONE, "Enter a phone number using digits, spaces and +")
          .refine((value) => phoneDigits(value) >= 6 && phoneDigits(value) <= 15, {
            message: "Enter a phone number with 6 to 15 digits",
          })
          .nullable(),
      )
      .nullable(),
    website: z
      .string()
      .trim()
      .max(200)
      .transform(emptyToNull)
      .pipe(
        z
          .string()
          .transform((value, ctx) => {
            const url = websiteUrl(value);
            if (!url) {
              ctx.addIssue({ code: "custom", message: "Enter a web address like example.com" });
              return z.NEVER;
            }
            return url;
          })
          .nullable(),
      )
      .nullable(),
  })
  .strict();

export type UpdateContactDetailsInput = z.infer<typeof updateContactDetailsSchema>;

const isoDate = z.string().datetime({ offset: true });

/**
 * `GET /legal-entities/activity`: filters by person, group and date, newest first, paged by the
 * last entry's id. Groups may repeat (`group=members&group=money`) or be comma-separated.
 */
export const organisationActivityQuerySchema = z
  .object({
    person: z.string().min(1).max(200).optional(),
    group: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : value.split(",")))
      .pipe(z.array(z.enum(ACTIVITY_GROUPS)).max(ACTIVITY_GROUPS.length))
      .optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    before: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .refine((v) => !v.from || !v.to || Date.parse(v.to) > Date.parse(v.from), {
    message: "The end must be after the start",
    path: ["to"],
  });

export type OrganisationActivityQuery = z.infer<typeof organisationActivityQuerySchema>;
