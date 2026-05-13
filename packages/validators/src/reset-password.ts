import { z } from "zod";
import { newPasswordWeakListCheck } from "./password-policy.js";

export const resetPasswordBodySchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(12, "Password must be at least 12 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((d, ctx) => newPasswordWeakListCheck(d.newPassword, ctx, ["newPassword"]));

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
