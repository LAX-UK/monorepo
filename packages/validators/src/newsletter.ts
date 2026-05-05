import { z } from "zod";

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  source: z.string().trim().min(1).max(100).optional(),
});

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
