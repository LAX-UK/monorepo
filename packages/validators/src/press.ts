import { z } from "zod";

export const pressArchiveQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  /** Filter by press item `publishedAt` calendar year (UTC). */
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  /** Case-insensitive match on sale title, headline, or outlet name. */
  q: z.string().trim().max(200).optional(),
});

export type PressArchiveQuery = z.infer<typeof pressArchiveQuerySchema>;

export const pressDayMediaQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

export type PressDayMediaQuery = z.infer<typeof pressDayMediaQuerySchema>;
