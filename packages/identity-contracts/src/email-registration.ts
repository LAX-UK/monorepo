import { z } from "zod";

/**
 * Machine route a product calls to learn whether an email already belongs to a LAX account,
 * for example before letting someone check out as a guest. It answers yes or no and nothing else:
 * no subject id, name or status leaves Identity.
 */
/** Under Identity's `/internal` machine base. */
export const IDENTITY_EMAIL_REGISTRATION_PATH = "/identity/emails/registration";

export const emailRegistrationRequestSchema = z.object({
  email: z.string().trim().min(3).max(254),
});

export const emailRegistrationResultSchema = z.object({ registered: z.boolean() }).strict();

export type EmailRegistrationResult = z.infer<typeof emailRegistrationResultSchema>;
