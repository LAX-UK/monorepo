import {
  EDITORIAL_STORY_CATEGORY_LABELS,
  type EditorialStoryCategory,
  type EditorialStoryKind,
  defaultEditorialStoryCategory,
} from "@auction/shop-contracts";

export const STORY_KINDS = [
  "article",
  "film",
  "podcast",
  "press",
  "guide",
] as const satisfies readonly EditorialStoryKind[];

export const STORY_KIND_LABELS: Record<EditorialStoryKind, string> = {
  article: "Article",
  film: "Film",
  podcast: "Podcast",
  press: "Press",
  guide: "Guide",
};

/** Story fields that only make sense for some kinds; every other field applies to all of them. */
export type StoryKindField =
  | "readMinutes"
  | "series"
  | "episodeNumber"
  | "audioUrl"
  | "durationSeconds"
  | "publicationName"
  | "externalUrl";

const KIND_FIELDS: Record<EditorialStoryKind, readonly StoryKindField[]> = {
  article: ["readMinutes"],
  guide: ["readMinutes", "series"],
  film: ["durationSeconds"],
  podcast: ["series", "episodeNumber", "audioUrl", "durationSeconds"],
  press: ["publicationName", "externalUrl"],
};

export function storyKindFields(kind: EditorialStoryKind): readonly StoryKindField[] {
  return KIND_FIELDS[kind];
}

export function storyKindHasField(kind: EditorialStoryKind, field: StoryKindField): boolean {
  return KIND_FIELDS[kind].includes(field);
}

/** Category choices, with a blank first option that names what the kind falls back to. */
export function storyCategoryOptions(
  kind: EditorialStoryKind,
): Array<{ value: EditorialStoryCategory | ""; label: string }> {
  const fallback = EDITORIAL_STORY_CATEGORY_LABELS[defaultEditorialStoryCategory(kind)];
  return [
    { value: "", label: `Default for ${STORY_KIND_LABELS[kind].toLowerCase()} (${fallback})` },
    ...Object.entries(EDITORIAL_STORY_CATEGORY_LABELS).map(([value, label]) => ({
      value: value as EditorialStoryCategory,
      label,
    })),
  ];
}

const DURATION = /^(?:(\d{1,3}):)?([0-5]?\d):([0-5]\d)$/;

/** "46:18" or "1:02:03" to seconds; null when the text is not a duration. */
export function parseDuration(text: string): number | null {
  const match = DURATION.exec(text.trim());
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pair = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pair(minutes)}:${pair(seconds)}` : `${minutes}:${pair(seconds)}`;
}
