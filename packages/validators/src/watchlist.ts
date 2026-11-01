import { WATCHED_LOT_REMINDER_KINDS, WATCHED_LOT_REMINDER_NOTE_MAX } from "@auction/domain";
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

/** `PUT /users/me/watchlist/:lotId/reminder`: when to be reminded, and an optional note. */
export const watchlistReminderBodySchema = z
  .object({
    kind: z.enum(WATCHED_LOT_REMINDER_KINDS),
    note: z
      .string()
      .trim()
      .max(WATCHED_LOT_REMINDER_NOTE_MAX, "Keep the note to 500 characters")
      .transform((value) => (value.length > 0 ? value : null))
      .nullable()
      .default(null),
  })
  .strict();

export type WatchlistReminderBody = z.infer<typeof watchlistReminderBodySchema>;
