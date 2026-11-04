import { SavedViewsError } from "./saved-views.js";

/**
 * The saved-view failures every staff tool reports in the same words, so a person sees one
 * message whichever tool's port raised it.
 */
export const savedViewsFailure = {
  /** The request never reached the server. */
  unreachable: () => new SavedViewsError("failed", "Could not reach the server. Try again."),
  /** The server answered with something this list cannot act on. */
  unknown: () => new SavedViewsError("failed", "Something went wrong. Try again."),
  /** The view was deleted elsewhere. */
  missing: () => new SavedViewsError("stale", "That view no longer exists."),
} as const;
