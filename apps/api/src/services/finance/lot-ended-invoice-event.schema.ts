import { z } from "zod";

/** Domain event payload for `lot.ended` consumed by invoice initiation projector. */
export const lotEndedInvoiceEventPayloadSchema = z.object({
  outcome: z.string().optional(),
  winnerId: z.string().uuid().nullable().optional(),
});

export type LotEndedInvoiceEventPayload = z.infer<typeof lotEndedInvoiceEventPayloadSchema>;

export function parseLotEndedInvoiceEventPayload(value: unknown): LotEndedInvoiceEventPayload {
  return lotEndedInvoiceEventPayloadSchema.parse(value ?? {});
}
