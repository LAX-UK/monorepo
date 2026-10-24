import type { Hono, MiddlewareHandler } from "hono";
import type { RequireRecentStaffAuth } from "../../middleware/require-recent-staff-auth.js";

export type AdminHono = Hono<{
  Variables: {
    userId?: string;
    userRole?: string;
    userStaffRole?: string | null;
    identitySessionId?: string;
  };
}>;

/**
 * What a dangerous staff mutation adds on top of its capability check: a recent sign-in, and
 * (for money) an Idempotency-Key. Mount them after the capability guard and before validation.
 */
export type AdminStaffMutationGuards = {
  requireStepUp: RequireRecentStaffAuth;
  idempotent: (scope: string) => MiddlewareHandler;
};

/** Only match UUID segments so static routes (`search`, `stats`, …) are never captured. */
export const adminArtistIdSegment =
  ":artistId{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}";
