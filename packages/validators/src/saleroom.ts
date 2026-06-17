import { z } from "zod";

export const adminSaleroomSaleIdParamSchema = z.object({
  saleId: z.string().uuid(),
});

export type AdminSaleroomSaleIdParams = z.infer<typeof adminSaleroomSaleIdParamSchema>;

export const saleroomAdvanceLotBodySchema = z.object({
  lotId: z.string().uuid(),
});

export type SaleroomAdvanceLotBody = z.infer<typeof saleroomAdvanceLotBodySchema>;

export const displayPairPollBodySchema = z.object({
  deviceCode: z.string().min(16).max(128),
});

export type DisplayPairPollBody = z.infer<typeof displayPairPollBodySchema>;

export const displayApproveBodySchema = z.object({
  userCode: z
    .string()
    .trim()
    .min(4)
    .max(12)
    .transform((v) => v.toUpperCase()),
});

export type DisplayApproveBody = z.infer<typeof displayApproveBodySchema>;

export const displayOverlayBodySchema = z.object({
  kind: z.enum(["fair_warning", "announcement"]),
  message: z.string().trim().max(500).optional(),
});

export type DisplayOverlayBody = z.infer<typeof displayOverlayBodySchema>;

export const displayRevokeBodySchema = z.object({
  pairingId: z.string().uuid(),
});

export type DisplayRevokeBody = z.infer<typeof displayRevokeBodySchema>;

export const displaySnapshotParamSchema = z.object({
  saleId: z.string().uuid(),
});

export type DisplaySnapshotParams = z.infer<typeof displaySnapshotParamSchema>;

export const adminSaleroomSessionBatchQuerySchema = z.object({
  saleIds: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().uuid()).min(1).max(50)),
});

export type AdminSaleroomSessionBatchQuery = z.infer<typeof adminSaleroomSessionBatchQuerySchema>;
