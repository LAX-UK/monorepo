import { registerBodySchema } from "@auction/validators";
import { z } from "zod";

export const signInFormSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignInFormValues = z.infer<typeof signInFormSchema>;

export const signUpFormSchema = registerBodySchema.extend({
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: "Please confirm you agree to the Terms and Privacy Notice and are 18 or over.",
  }),
});

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;

export const forgotPasswordFormSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
