import { z } from "zod";

export const lotCreatedPayloadSchema = z.object({
  saleId: z.string().uuid().nullable(),
  source: z.enum(["staff_create", "sale_create", "submission"]),
});

export const lotActivatedPayloadSchema = z.object({
  saleId: z.string().uuid().nullable(),
  activatedAt: z.string().datetime(),
});

export const lotAttachedToSalePayloadSchema = z.object({
  saleId: z.string().uuid(),
  lotNumber: z.number().nullable(),
  fromSaleId: z.string().uuid().nullable(),
  via: z.enum(["attach_endpoint", "patch", "wizard"]),
});

export const lotDetachedFromSalePayloadSchema = z.object({
  fromSaleId: z.string().uuid(),
});

export const lotPublishedPayloadSchema = z.object({
  saleId: z.string().uuid().nullable(),
});

export const lotUnpublishedPayloadSchema = z.object({
  saleId: z.string().uuid().nullable(),
  reason: z.enum(["sale_unpublish", "manual"]),
});

export const lotCancelledPayloadSchema = z.object({
  reason: z.enum(["manual", "sale_cancel", "sale_soft_delete", "soft_delete", "withdrawal", "admin_override"]),
});

export const lotEndedTriggerSchema = z.enum([
  "timed",
  "clerk_hammer",
  "clerk_no_sale",
  "onsite_sale_end",
  "admin_override",
  "early_close",
]);

export const lotEndedPayloadSchema = z.object({
  outcome: z.enum(["sold", "no_sale"]),
  winnerId: z.string().nullable(),
  saleId: z.string().uuid().nullable(),
  trigger: lotEndedTriggerSchema,
  hammerPrice: z.string().nullable().optional(),
  hadWinner: z.boolean().optional(),
  endedAt: z.string().datetime().optional(),
});

export const lotVoidedPayloadSchema = z.object({
  reason: z.string(),
});

export const lotWithdrawalRequestedPayloadSchema = z.object({
  sellerLegalEntityId: z.string().uuid(),
});

export const lotReturnedToInventoryPayloadSchema = z.object({
  fromStatus: z.enum(["ended", "cancelled", "voided"]),
  lastSaleId: z.string().uuid().nullable(),
  reason: z.string(),
});

export const LotEventSchemas = {
  "lot.created": lotCreatedPayloadSchema,
  "lot.activated": lotActivatedPayloadSchema,
  "lot.attached_to_sale": lotAttachedToSalePayloadSchema,
  "lot.detached_from_sale": lotDetachedFromSalePayloadSchema,
  "lot.published": lotPublishedPayloadSchema,
  "lot.unpublished": lotUnpublishedPayloadSchema,
  "lot.cancelled": lotCancelledPayloadSchema,
  "lot.ended": lotEndedPayloadSchema,
  "lot.voided": lotVoidedPayloadSchema,
  "lot.withdrawal_requested": lotWithdrawalRequestedPayloadSchema,
  "lot.returned_to_inventory": lotReturnedToInventoryPayloadSchema,
} as const;

export type LotEventType = keyof typeof LotEventSchemas;

export type LotEventPayload<T extends LotEventType> = z.infer<(typeof LotEventSchemas)[T]>;

export type LotCreatedPayload = z.infer<typeof lotCreatedPayloadSchema>;
export type LotAttachedToSalePayload = z.infer<typeof lotAttachedToSalePayloadSchema>;
export type LotDetachedFromSalePayload = z.infer<typeof lotDetachedFromSalePayloadSchema>;
export type LotCancelledPayload = z.infer<typeof lotCancelledPayloadSchema>;
export type LotEndedPayload = z.infer<typeof lotEndedPayloadSchema>;
export type LotReturnedToInventoryPayload = z.infer<typeof lotReturnedToInventoryPayloadSchema>;

export function parseLotEventPayload<T extends LotEventType>(
  eventType: T,
  payload: unknown,
): LotEventPayload<T> {
  return LotEventSchemas[eventType].parse(payload) as LotEventPayload<T>;
}
