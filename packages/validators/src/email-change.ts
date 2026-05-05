import { z } from "zod";

export const requestEmailChangeSchema = z
  .object({
    newEmail: z.string().email("Enter a valid email address"),
    confirmEmail: z.string().email("Confirm the new email address"),
  })
  .refine((value) => value.newEmail === value.confirmEmail, {
    message: "Email addresses do not match",
    path: ["confirmEmail"],
  });

export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;
