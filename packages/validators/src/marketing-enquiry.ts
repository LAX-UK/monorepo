import {
  ENQUIRY_BUDGET_BANDS,
  ENQUIRY_CLOSE_REASONS,
  ENQUIRY_CONTACT_PREFERENCES,
  ENQUIRY_INTENTS,
  ENQUIRY_STATUSES,
  ENQUIRY_TIMINGS,
  ENQUIRY_VIEWS,
} from "@auction/domain";
import { z } from "zod";

/** The topics the public contact form offers. */
export const CONTACT_TOPICS = ["buying", "selling", "shipping", "press", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** A contact form message as the API takes it. The web form validates the same limits. */
export const contactEnquirySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().min(1).email().max(254),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(10).max(5000),
  phone: z.string().trim().min(3).max(40).optional(),
  /** The page the form was sent from, as a path (for example `/contact?intent=press`). */
  sourcePage: z.string().trim().max(300).startsWith("/").optional(),
});
export type ContactEnquiryInput = z.infer<typeof contactEnquirySchema>;

export const marketingEnquiryIdParamSchema = z.object({ id: z.string().uuid() });

const emailSchema = z.string().trim().toLowerCase().min(1).email().max(254);
const departmentSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Who is asking and how to reach them; common to every path. */
const enquirerFields = {
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  phone: z.string().trim().min(3).max(40).optional(),
  contactPreference: z.enum(ENQUIRY_CONTACT_PREFERENCES).default("email"),
  /** The unticked box: true only when the sender asked for news. */
  marketingOptIn: z.boolean().default(false),
  sourcePage: z.string().trim().max(300).startsWith("/").optional(),
};

/**
 * The general contact form. The legacy payload (topic, message, no intent) is this schema with the
 * defaults filled in, so the web app can switch to the structured payload on its own schedule.
 */
export const generalEnquirySchema = z.object({
  intent: z.literal("general"),
  ...enquirerFields,
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(10).max(5000),
});

/** A seller offering a work privately: the work, where it is and what they have in mind. */
export const privateSaleSellEnquirySchema = z.object({
  intent: z.literal("private_sale_sell"),
  ...enquirerFields,
  /** A public Sell department slug; routes the enquiry to that department's specialist. */
  departmentSlug: departmentSlugSchema,
  artist: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  medium: z.string().trim().min(1).max(200).optional(),
  size: z.string().trim().min(1).max(200).optional(),
  locationTown: z.string().trim().min(1).max(120),
  locationCountry: z.string().trim().min(1).max(120),
  /** In pence; absent when the seller is not sure yet. */
  priceInMindMinor: z.number().int().positive().max(1_000_000_000_000).optional(),
  message: z.string().trim().max(5000).optional(),
});

/** A buyer asking to be shown works privately. */
export const privateSaleBuyEnquirySchema = z.object({
  intent: z.literal("private_sale_buy"),
  ...enquirerFields,
  lookingFor: z.string().trim().min(3).max(2000),
  budgetBand: z.enum(ENQUIRY_BUDGET_BANDS),
  timing: z.enum(ENQUIRY_TIMINGS),
  message: z.string().trim().max(5000).optional(),
});

const enquiryPathSchema = z.discriminatedUnion("intent", [
  generalEnquirySchema,
  privateSaleSellEnquirySchema,
  privateSaleBuyEnquirySchema,
]);

/**
 * What `POST /contact-enquiries` accepts: one schema per path, chosen by `intent`. A payload with
 * no intent is the contact form's original shape and is read as a general enquiry.
 */
export const enquiryIntakeSchema = z.preprocess(
  (value) =>
    typeof value === "object" && value !== null && !("intent" in value)
      ? { ...value, intent: "general" }
      : value,
  enquiryPathSchema,
);
export type GeneralEnquiryInput = z.infer<typeof generalEnquirySchema>;
export type PrivateSaleSellEnquiryInput = z.infer<typeof privateSaleSellEnquirySchema>;
export type PrivateSaleBuyEnquiryInput = z.infer<typeof privateSaleBuyEnquirySchema>;
export type EnquiryIntakeInput =
  | GeneralEnquiryInput
  | PrivateSaleSellEnquiryInput
  | PrivateSaleBuyEnquiryInput;

/** An enquiry as staff address it: the reference staff and senders quote, or its id. */
export const enquiryRefParamSchema = z.object({
  ref: z
    .string()
    .trim()
    .regex(
      /^(?:E-\d{4,}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,
    ),
});

/** The Enquiries list: a view, filters on top of it, and a cursor to continue. */
export const adminEnquiryListQuerySchema = z.object({
  view: z.enum(ENQUIRY_VIEWS).default("open"),
  kind: z.enum(ENQUIRY_INTENTS).optional(),
  department: departmentSlugSchema.optional(),
  status: z.enum(ENQUIRY_STATUSES).optional(),
  assignee: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminEnquiryListQuery = z.infer<typeof adminEnquiryListQuerySchema>;

/** One change to an enquiry. `version` is the version the person was looking at. */
export const adminEnquiryPatchSchema = z
  .object({
    version: z.number().int().min(1),
    assignedToUserId: z.string().trim().min(1).max(100).nullable().optional(),
    status: z.enum(ENQUIRY_STATUSES).optional(),
    closeReason: z.enum(ENQUIRY_CLOSE_REASONS).optional(),
    note: z.string().trim().min(1).max(5000).optional(),
  })
  .refine(
    (patch) =>
      patch.assignedToUserId !== undefined ||
      patch.status !== undefined ||
      patch.closeReason !== undefined ||
      patch.note !== undefined,
    { message: "Nothing to change" },
  );
export type AdminEnquiryPatch = z.infer<typeof adminEnquiryPatchSchema>;

/** The whole routing table: a specialist per department and at most one fallback. */
export const adminEnquiryRoutingSchema = z
  .object({
    rules: z
      .array(
        z.object({
          /** Null is the fallback for departments without a rule. */
          departmentSlug: departmentSlugSchema.nullable(),
          assignedToUserId: z.string().trim().min(1).max(100),
        }),
      )
      .max(100),
  })
  .refine(({ rules }) => new Set(rules.map((rule) => rule.departmentSlug)).size === rules.length, {
    message: "Each department, and the fallback, may appear once",
  });
export type AdminEnquiryRoutingInput = z.infer<typeof adminEnquiryRoutingSchema>;
