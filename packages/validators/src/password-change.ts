import { z } from "zod";
import { newPasswordWeakListCheck } from "./password-policy.js";

/** Client form for Better Auth change-password (confirm matches new). */
export const passwordChangeFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(12, "Use at least 12 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((d, ctx) => newPasswordWeakListCheck(d.newPassword, ctx, ["newPassword"]));

export type PasswordChangeFormValues = z.infer<typeof passwordChangeFormSchema>;
