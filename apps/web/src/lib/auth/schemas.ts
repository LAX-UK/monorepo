import { newPasswordWeakListCheck } from "@auction/validators";
import { z } from "zod";

export const resetPasswordFormSchema = z
  .object({
    newPassword: z.string().min(12, "Password must be at least 12 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((d, ctx) => newPasswordWeakListCheck(d.newPassword, ctx, ["newPassword"]));

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
