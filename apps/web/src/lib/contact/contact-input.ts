import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  topic: z.enum(["buying", "selling", "shipping", "press", "other"]),
  message: z.string().min(10).max(5000),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** RHF + honeypot `website` (ignored when non-empty). */
export const contactFormValuesSchema = contactSchema.extend({
  website: z.string().optional(),
});
export type ContactFormValues = z.infer<typeof contactFormValuesSchema>;

export function isContactHoneypotFilled(formData: FormData): boolean {
  return String(formData.get("website") ?? "").trim().length > 0;
}

export type ContactParseResult = { ok: true; data: ContactInput } | { ok: false };

export function parseContactFormData(formData: FormData): ContactParseResult {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    topic: String(formData.get("topic") ?? ""),
    message: String(formData.get("message") ?? ""),
  };
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  return { ok: true, data: parsed.data };
}
