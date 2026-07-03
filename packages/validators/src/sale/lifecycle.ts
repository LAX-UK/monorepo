import { z } from "zod";
import { bulkIdListSchema } from "../lot/lifecycle.js";

export const cancelSaleBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

/** Exact phrase staff must type to confirm sale soft-delete (case-sensitive). */
export function saleDeleteConfirmationPhrase(title: string): string {
  return `DELETE ${title}`;
}

export const deleteSaleBodySchema = z.object({
  confirmationPhrase: z.string().min(1).max(500),
});

/** Exact phrase staff must type to confirm bulk sale soft-delete (case-sensitive). */
export function bulkSaleDeleteConfirmationPhrase(count: number): string {
  return `DELETE ${count} DRAFT SALES`;
}

export const bulkSalesBodySchema = z
  .object({
    ids: bulkIdListSchema,
    op: z.enum(["soft_delete"]),
    confirmationPhrase: z.string().min(1).max(500),
  })
  .superRefine((data, ctx) => {
    if (!data.confirmationPhrase.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confirmationPhrase is required",
        path: ["confirmationPhrase"],
      });
    }
  });

export const markSaleEndedBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const updateSaleStatusBodySchema = z.object({
  status: z.enum(["scheduled", "active", "ended", "cancelled"]),
  reason: z.string().max(500).optional(),
});

export const updateLotStatusBodySchema = z.object({
  status: z.enum(["draft", "scheduled", "active", "ended", "cancelled"]),
  reason: z.string().max(500).optional(),
});
