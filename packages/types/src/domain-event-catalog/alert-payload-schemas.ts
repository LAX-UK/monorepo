import { z } from "zod";

/**
 * An alert subscription became confirmed by the person's own act (a confirm link, or an account
 * switching email alerts on). Carries the address hash, never the address: the consumer lifts an
 * old Zoho Campaigns marketing opt-out for that hash.
 */
export const alertSubscriptionConfirmedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  emailHash: z.string().min(1),
  product: z.enum(["bid", "shop", "art"]),
  confirmedAt: z.string().datetime({ offset: true }),
});
