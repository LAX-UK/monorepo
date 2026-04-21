import { z } from "zod";

export const artistWatchlistBodySchema = z.object({
  artistId: z.string().min(1).max(128),
});

export const artistWatchlistArtistIdParamSchema = z.object({
  artistId: z.string().min(1).max(128),
});
