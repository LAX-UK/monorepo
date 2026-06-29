import type { Hono } from "hono";

export type AdminHono = Hono<{
  Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
}>;

/** Only match UUID segments so static routes (`search`, `stats`, …) are never captured. */
export const adminArtistIdSegment =
  ":artistId{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}";
