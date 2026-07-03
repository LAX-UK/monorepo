import { lotStatuses } from "@auction/types";
import { z } from "zod";

const listSort = z
  .enum(["createdDesc", "endingAsc", "hammerDesc", "endedDesc", "sellerAsc"])
  .optional();

export const listLotsQuerySchema = z.object({
  status: z.enum(lotStatuses).optional(),
  statuses: z
    .string()
    .optional()
    .transform((s) => {
      if (!s?.trim()) return undefined;
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean) as (typeof lotStatuses)[number][];
    })
    .refine((arr) => arr == null || arr.every((x) => lotStatuses.includes(x)), {
      message: "Invalid lot status in statuses",
    }),
  categoryId: z.string().uuid().optional(),
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
  sellerId: z.string().uuid().optional(),
  winnerId: z.string().uuid().optional(),
  saleId: z.string().uuid().optional(),
  artistId: z.string().uuid().optional(),
  endYear: z.coerce.number().int().min(1970).max(2100).optional(),
  /** Case-insensitive substring on lot title (server-side search). */
  q: z.string().trim().max(200).optional(),
  /** Active lots ending within N hours (e.g. 24 for "ending soon"). */
  endingWithinHours: z.coerce.number().int().min(1).max(168).optional(),
  /** When `1`, only lots with zero images (staff attention lens). */
  needsPhotos: z.enum(["1"]).optional(),
  /** When `0`, skip CDN URL resolution (staff lists that do not render thumbnails). */
  resolveImages: z.enum(["0", "1"]).optional(),
  sort: listSort,
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const archiveSummaryQuerySchema = z.object({
  endYear: z.coerce.number().int().min(1970).max(2100).optional(),
});

/** Same filters as archive grid; status is always `ended` on the server. */
export const archiveCountQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
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
  endYear: z.coerce.number().int().min(1970).max(2100).optional(),
});
