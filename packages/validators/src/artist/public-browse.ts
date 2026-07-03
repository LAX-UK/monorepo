import { z } from "zod";
import { artistKindEnum } from "./shared-fields.js";

/** Public paginated directory (`GET /artists/browse`). */
export const publicArtistBrowseQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(48).optional().default(24),
  offset: z.coerce.number().int().min(0).max(100_000).optional().default(0),
  q: z.string().trim().max(200).optional(),
  kind: artistKindEnum.optional(),
  /** Comma-separated kinds; takes precedence over `kind` when both are sent. */
  kinds: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((raw) => {
      if (!raw) return undefined;
      const tokens = raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const out: z.infer<typeof artistKindEnum>[] = [];
      for (const t of tokens) {
        const p = artistKindEnum.safeParse(t);
        if (p.success) out.push(p.data);
      }
      return out.length ? out : undefined;
    }),
  letter: z.string().trim().max(8).optional(),
  living: z.coerce.boolean().optional(),
  historical: z.coerce.boolean().optional(),
  nationality: z.string().trim().max(120).optional(),
  /** Filter by collecting category (department) slug, e.g. `motor-cars`. */
  categorySlug: z.string().trim().max(120).optional(),
  /** Filter by ISO 3166-1 alpha-2 origin country code. */
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  featuredOnly: z.coerce.boolean().optional(),
  featuredFirst: z.coerce.boolean().optional(),
  /** Decade slug like `1900s`, `1980s`, or `pre-1800`. Filters by `birth_year`. */
  decade: z
    .string()
    .trim()
    .regex(/^(pre-1800|\d{4}s)$/i, "Decade must be like `1900s` or `pre-1800`.")
    .max(16)
    .optional(),
  /** When true, only artists with at least one `active` or `scheduled` lot. */
  hasUpcoming: z.coerce.boolean().optional(),
  sort: z
    .union([z.enum(["name_asc", "popular", "recent"]), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.enum(["name_asc", "popular", "recent"]).optional().default("name_asc")),
});
