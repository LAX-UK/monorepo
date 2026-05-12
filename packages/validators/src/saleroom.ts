import { z } from "zod";

export const adminSaleroomSaleIdParamSchema = z.object({
  saleId: z.string().uuid(),
});

export type AdminSaleroomSaleIdParams = z.infer<typeof adminSaleroomSaleIdParamSchema>;

export const saleroomAdvanceLotBodySchema = z.object({
  lotId: z.string().uuid(),
});

export type SaleroomAdvanceLotBody = z.infer<typeof saleroomAdvanceLotBodySchema>;
