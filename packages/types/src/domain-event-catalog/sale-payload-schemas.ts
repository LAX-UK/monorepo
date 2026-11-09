import { z } from "zod";

/** A sale's start time was moved. Ids and instants only; nothing that names a person. */
export const saleRescheduledPayloadSchema = z.object({
  saleId: z.string().uuid(),
  previousStartAt: z.string().datetime(),
  newStartAt: z.string().datetime(),
});

export const SaleEventSchemas = {
  "sale.rescheduled": saleRescheduledPayloadSchema,
} as const;

export type SaleRescheduledPayload = z.infer<typeof saleRescheduledPayloadSchema>;
