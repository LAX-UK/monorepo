/**
 * A story reaches readers through cards that lead with its cover, so a story needs a cover image
 * before it can be published or featured. This is the single statement of that rule; the admin
 * routes enforce it and the editor mirrors it.
 */
export type StoryCoverState = {
  coverMediaKey: string | null | undefined;
  featured: boolean;
  /** Whether the story is published after the change being checked. */
  published: boolean;
};

/** What the story is being put into without a cover: the first violated step, or null when fine. */
export type StoryCoverViolation = "publish" | "feature";

export function hasStoryCover(coverMediaKey: string | null | undefined): boolean {
  return typeof coverMediaKey === "string" && coverMediaKey.trim().length > 0;
}

export function storyCoverViolation(state: StoryCoverState): StoryCoverViolation | null {
  if (hasStoryCover(state.coverMediaKey)) return null;
  if (state.published) return "publish";
  if (state.featured) return "feature";
  return null;
}

export const STORY_COVER_REQUIRED_FIELD = "coverMediaKey";

export const STORY_COVER_REQUIRED_MESSAGES: Record<StoryCoverViolation, string> = {
  publish: "Add a cover image before publishing this story.",
  feature: "Add a cover image before featuring this story.",
};
