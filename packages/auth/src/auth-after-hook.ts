import type { AuthMiddleware } from "better-auth/api";

/**
 * One entry of a plugin's `hooks.after` list. The matcher only reads the path, so it can be
 * tested without a full endpoint context.
 *
 * Exported hook builders return this named type instead of an inferred one. An inferred type
 * would make the declaration build spell out better-auth's internal middleware types by their
 * install path, which differs between the hoisted local install and the isolated install in
 * the Docker images, and fails the image build there (TS2742).
 */
export interface AuthAfterHook {
  matcher: (context: { path?: string }) => boolean;
  handler: AuthMiddleware;
}
