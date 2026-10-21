import { Type } from "@sinclair/typebox";

export const EditorialStoryKindSchema = Type.Union([
  Type.Literal("article"),
  Type.Literal("film"),
  Type.Literal("press"),
  Type.Literal("guide"),
  Type.Literal("podcast"),
]);

export type EditorialStoryKind = typeof EditorialStoryKindSchema.static;

/**
 * Display category of a story (lax.art stories index and cards). `kind` still decides the
 * format (prose, video, audio, external press link); `category` is the editorial label.
 */
export const EditorialStoryCategorySchema = Type.Union([
  Type.Literal("article"),
  Type.Literal("artist_interview"),
  Type.Literal("artist_conversation"),
  Type.Literal("studio_visit"),
  Type.Literal("film"),
  Type.Literal("press"),
  Type.Literal("podcast"),
  Type.Literal("collecting_guide"),
  Type.Literal("exhibition"),
]);

export type EditorialStoryCategory = typeof EditorialStoryCategorySchema.static;

/** Category assumed for stories saved before categories existed, or left blank by an editor. */
const DEFAULT_CATEGORY_BY_KIND: Readonly<Record<EditorialStoryKind, EditorialStoryCategory>> = {
  article: "article",
  film: "film",
  press: "press",
  guide: "collecting_guide",
  podcast: "podcast",
};

export function defaultEditorialStoryCategory(kind: EditorialStoryKind): EditorialStoryCategory {
  return DEFAULT_CATEGORY_BY_KIND[kind];
}

/** Every kind with its default category, for callers that resolve the default in SQL. */
export const EDITORIAL_STORY_DEFAULT_CATEGORIES = Object.entries(DEFAULT_CATEGORY_BY_KIND) as [
  EditorialStoryKind,
  EditorialStoryCategory,
][];

export const EDITORIAL_STORY_CATEGORY_LABELS: Readonly<Record<EditorialStoryCategory, string>> = {
  article: "Article",
  artist_interview: "Artist interview",
  artist_conversation: "Artist conversation",
  studio_visit: "Studio visit",
  film: "Film",
  press: "Press",
  podcast: "LAX Podcast",
  collecting_guide: "Collecting guide",
  exhibition: "Exhibition",
};

/** The three tabs of the lax.art stories index. */
export type EditorialStoryTab = "stories_and_films" | "podcast" | "press";

export const EDITORIAL_STORY_TAB_LABELS: Readonly<Record<EditorialStoryTab, string>> = {
  stories_and_films: "Artist stories & films",
  podcast: "LAX's Podcast",
  press: "Press",
};

export function editorialStoryTab(category: EditorialStoryCategory): EditorialStoryTab {
  if (category === "podcast") return "podcast";
  if (category === "press") return "press";
  return "stories_and_films";
}
