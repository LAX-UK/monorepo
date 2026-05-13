import { z } from "zod";
import { newPasswordWeakListCheck } from "./password-policy.js";

/** First-time password setup body for OAuth-only users (server contract).
 * Mirrors {@link registerBodySchema}'s length envelope so behaviour matches
 * the rest of the auth surface.
 */
export const setupPasswordBodySchema = z
  .object({
    password: z.string().min(12).max(128),
  })
  .superRefine((d, ctx) => newPasswordWeakListCheck(d.password, ctx, ["password"]));

export type SetupPasswordBody = z.infer<typeof setupPasswordBodySchema>;

/** Client-side form schema. Includes confirm field for UX parity with
 * password-change; do not import server-side.
 */
export const setupPasswordFormSchema = z
  .object({
    newPassword: z.string().min(12, "Use at least 12 characters").max(128),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((d, ctx) => newPasswordWeakListCheck(d.newPassword, ctx, ["newPassword"]));

export type SetupPasswordFormValues = z.infer<typeof setupPasswordFormSchema>;
