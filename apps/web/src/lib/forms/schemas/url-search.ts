import { z } from "zod";

/** Shared: portfolio / bids “filter by title” in URL `q` */
export const urlTitleSearchSchema = z.object({
  q: z.string().max(200),
});

export type UrlTitleSearchValues = z.infer<typeof urlTitleSearchSchema>;

/** Admin payments local filter (client-side) */
export const adminPaymentLocalSearchSchema = z.object({
  q: z.string().max(200),
});

export type AdminPaymentLocalSearchValues = z.infer<typeof adminPaymentLocalSearchSchema>;

/** Inbox: filter by notification `type` query */
export const notificationTypeFilterFormSchema = z.object({
  type: z.string().max(100),
});
