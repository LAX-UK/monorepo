import { z } from "zod";

export const watchlistBodySchema = z.object({
  lotId: z.string().uuid(),
});

export const watchlistQuerySchema = z.object({
  sort: z
    .enum(["addedDesc", "endingSoon", "priceAsc", "priceDesc"])
    .optional()
    .default("addedDesc"),
  status: z.enum(["active", "scheduled", "ended"]).optional(),
  categoryIds: z
    .string()
    .optional()
    .transform((s) => {
      if (!s?.trim()) return undefined;
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    })
    .refine((arr) => arr == null || arr.every((x) => z.string().uuid().safeParse(x).success), {
      message: "Invalid category ID in categoryIds",
    }),
});

export type WatchlistQuery = z.infer<typeof watchlistQuerySchema>;
