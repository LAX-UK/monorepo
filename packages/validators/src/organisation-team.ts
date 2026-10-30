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
