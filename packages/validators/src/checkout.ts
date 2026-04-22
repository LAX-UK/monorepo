import { z } from "zod";

/** UI-only: terms acceptance before creating a payment record (checkout panel). */
export const checkoutTermsAcceptanceSchema = z.object({
  termsAccepted: z.boolean().refine((v) => v === true, {
    message: "You must accept the terms to continue.",
  }),
});

export type CheckoutTermsAcceptanceValues = z.infer<typeof checkoutTermsAcceptanceSchema>;
