import { newPasswordWeakListCheck, registerBodySchema } from "@auction/validators";
import { z } from "zod";

export const signInFormSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignInFormValues = z.infer<typeof signInFormSchema>;

export const signUpFormSchema = registerBodySchema.and(
  z.object({
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: "Please confirm you agree to the Terms and Privacy Notice and are 18 or over.",
    }),
  }),
);

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;

export const forgotPasswordFormSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;

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
