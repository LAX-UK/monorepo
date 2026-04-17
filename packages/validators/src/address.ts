import { z } from "zod";

export const createAddressBodySchema = z.object({
  label: z.string().min(1).max(80),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  state: z.string().max(120).optional(),
  postalCode: z.string().min(1).max(32),
  country: z.string().min(2).max(120),
  isDefault: z.boolean().optional(),
});

export const updateAddressBodySchema = createAddressBodySchema.partial();

export const addressIdParamSchema = z.object({
  id: z.string().uuid(),
});
