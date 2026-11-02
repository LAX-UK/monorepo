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
