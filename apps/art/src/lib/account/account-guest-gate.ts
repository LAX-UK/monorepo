import { type ArtViewerState, artStorefrontLoginHref } from "@/lib/art-viewer-state";

const DEFAULT_RETURN_PATH = "/account";

/** The path to return to after sign-in: the requested path, or the account home. */
export function accountReturnPath(requested: string | null | undefined): string {
  const path = requested?.trim();
  return path?.startsWith("/") && !path.startsWith("//") ? path : DEFAULT_RETURN_PATH;
}

/**
 * Where a signed-out visitor to the account area goes, or `null` when they may continue (signed
 * in, disabled and unavailable viewers are handled by each page). Decided before the page streams,
 * so the answer is a real redirect rather than a page that navigates after it loads.
 */
export function guestAccountRedirect(
  viewer: ArtViewerState,
  requestedPath: string | null | undefined,
): string | null {
  if (viewer.kind !== "guest") return null;
  return artStorefrontLoginHref(accountReturnPath(requestedPath));
}
