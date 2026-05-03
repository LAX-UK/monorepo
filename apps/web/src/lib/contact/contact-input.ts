import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  topic: z.enum(["buying", "selling", "shipping", "press", "other"]),
  message: z.string().min(10).max(5000),
});

export type ContactInput = z.infer<typeof contactSchema>;

/**
 * RHF schema. Adds:
 * - Honeypot `website` (ignored when non-empty).
 * - Optional split-name fields `firstName` / `lastName`. The mockup splits
 *   the legacy single `Name` field into two; we keep the wire contract by
 *   collapsing both back into `name` before submission.
 *
 * Schema-level `name` is widened to optional + an extra refine: either
 * `name` or `firstName/lastName` must be populated.
 */
export const contactFormValuesSchema = contactSchema
  .extend({
    name: z.string().max(120).optional(),
    website: z.string().optional(),
    firstName: z.string().max(120).optional(),
    lastName: z.string().max(120).optional(),
  })
  .superRefine((values, ctx) => {
    const hasName = (values.name ?? "").trim().length > 0;
    const hasFirst = (values.firstName ?? "").trim().length > 0;
    const hasLast = (values.lastName ?? "").trim().length > 0;
    if (!hasName && !(hasFirst || hasLast)) {
      ctx.addIssue({
        code: "custom",
        path: ["firstName"],
        message: "Please enter your name",
      });
    }
  });
export type ContactFormValues = z.infer<typeof contactFormValuesSchema>;

/** Resolve the wire `name` from either the legacy single field or split fields. */
export function resolveContactName(
  values: Pick<ContactFormValues, "name" | "firstName" | "lastName">,
): string {
  const trimmed = (values.name ?? "").trim();
  if (trimmed) return trimmed;
  const first = (values.firstName ?? "").trim();
  const last = (values.lastName ?? "").trim();
  return `${first} ${last}`.trim();
}

export function isContactHoneypotFilled(formData: FormData): boolean {
  return String(formData.get("website") ?? "").trim().length > 0;
}

export type ContactParseResult = { ok: true; data: ContactInput } | { ok: false };

export function parseContactFormData(formData: FormData): ContactParseResult {
  const rawName = String(formData.get("name") ?? "");
  const fallback = resolveContactName({
    name: rawName,
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
  });
  const raw = {
    name: fallback,
    email: String(formData.get("email") ?? ""),
    topic: String(formData.get("topic") ?? ""),
    message: String(formData.get("message") ?? ""),
  };
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  return { ok: true, data: parsed.data };
}
