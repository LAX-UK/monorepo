import { z } from "zod";

/** First-time password setup body for OAuth-only users (server contract).
 * Mirrors {@link registerBodySchema}'s length envelope so behaviour matches
 * the rest of the auth surface.
 */
export const setupPasswordBodySchema = z.object({
  password: z.string().min(8).max(128),
});

export type SetupPasswordBody = z.infer<typeof setupPasswordBodySchema>;

/** Client-side form schema. Includes confirm field for UX parity with
 * password-change; do not import server-side.
 */
export const setupPasswordFormSchema = z
  .object({
    newPassword: z.string().min(8, "Use at least 8 characters").max(128),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SetupPasswordFormValues = z.infer<typeof setupPasswordFormSchema>;
