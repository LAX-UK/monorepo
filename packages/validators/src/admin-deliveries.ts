import { DELIVERY_QUOTE_DECLINE_REASON_MAX_LENGTH, DELIVERY_STATUSES } from "@auction/domain";
import { z } from "zod";

/** The order of a Deliveries view: the newest request first, or the one waiting longest. */
export const ADMIN_DELIVERY_SORTS = ["newest", "oldest"] as const;
export type AdminDeliverySort = (typeof ADMIN_DELIVERY_SORTS)[number];

/**
 * One page of the staff Deliveries list (docs/design/staff-gaps-delivery-zoho-alerts.md, D7): a
 * view (the combined delivery status), a search over lot, paddle, buyer and destination, and the
 * sale filter.
 */
export const adminDeliveriesListQuerySchema = z
  .object({
    view: z.enum(DELIVERY_STATUSES).default("waiting"),
    q: z.string().trim().max(120).optional(),
    saleId: z.string().uuid().optional(),
    sort: z.enum(ADMIN_DELIVERY_SORTS).default("newest"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict();
export type AdminDeliveriesListQuery = z.infer<typeof adminDeliveriesListQuerySchema>;

export const adminDeliveryLotIdParamSchema = z.object({ lotId: z.string().uuid() });

/**
 * Staff decline a delivery quote ("Can't deliver", D8). The reason is sent to the buyer as written,
 * trimmed; the same limits hold in the database.
 */
export const adminDeliveryDeclineBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Tell the buyer why you can't deliver")
      .max(
        DELIVERY_QUOTE_DECLINE_REASON_MAX_LENGTH,
        `Use ${DELIVERY_QUOTE_DECLINE_REASON_MAX_LENGTH} characters or fewer`,
      ),
  })
  .strict();
export type AdminDeliveryDeclineBody = z.infer<typeof adminDeliveryDeclineBodySchema>;
