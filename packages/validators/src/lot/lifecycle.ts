import { z } from "zod";

export const cancelLotBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

/** Exact phrase staff must type to confirm lot soft-delete (case-sensitive). */
export function lotDeleteConfirmationPhrase(title: string): string {
  return `DELETE ${title}`;
}

export const deleteLotBodySchema = z.object({
  confirmationPhrase: z.string().min(1).max(500),
});

/** Exact phrase staff must type to confirm bulk lot soft-delete (case-sensitive). */
export function bulkLotDeleteConfirmationPhrase(count: number): string {
  return `DELETE ${count} DRAFT LOTS`;
}

/** Dedupes bulk ids while preserving first-seen order. */
export const bulkIdListSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(50)
  .transform((ids) => [...new Set(ids)]);

export const bulkLotsBodySchema = z
  .object({
    ids: bulkIdListSchema,
    op: z.enum(["publish", "cancel", "soft_delete"]),
    reason: z.string().max(500).optional(),
    confirmationPhrase: z.string().min(1).max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.op === "soft_delete" && !data.confirmationPhrase?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confirmationPhrase is required for soft_delete",
        path: ["confirmationPhrase"],
      });
    }
  });

export const scheduleAbsenteeBidBodySchema = z.object({
  buyerLegalEntityId: z.string().uuid(),
  maxAmount: z.coerce.number().finite().positive().max(1e12),
});

export type ScheduleAbsenteeBidBody = z.infer<typeof scheduleAbsenteeBidBodySchema>;

export const adminTelephonePlaceBidBodySchema = z.object({
  lotId: z.string().uuid(),
  buyerUserId: z.string().min(1).max(191),
  buyerLegalEntityId: z.string().uuid(),
  amount: z.coerce.number().finite().positive().max(1e12),
  maxAutoBidAmount: z.coerce.number().finite().positive().max(1e12).optional(),
  telephoneBookingId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export type AdminTelephonePlaceBidBody = z.infer<typeof adminTelephonePlaceBidBodySchema>;
