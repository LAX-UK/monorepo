import type { LaxIllustrationName } from "../components/ui/lax-illustration.js";

/**
 * The drawing names the Shop and lax.art status wrappers accept: every LAX drawing, plus the
 * older names their pages still pass. `gallery` is the empty frame, `search-remove`
 * the magnifier, `bag` the parcel and `alert` the askew frame.
 */
export type StatusIllustration =
  | LaxIllustrationName
  | "search-remove"
  | "bag"
  | "gallery"
  | "alert";

const ALIASES: Partial<Record<StatusIllustration, LaxIllustrationName>> = {
  gallery: "frame",
  "search-remove": "search",
  bag: "parcel",
  alert: "askew",
};

/** The LAX drawing for a status name; the one map both product wrappers use. */
export function resolveStatusIllustration(name: StatusIllustration): LaxIllustrationName {
  return ALIASES[name] ?? (name as LaxIllustrationName);
}
