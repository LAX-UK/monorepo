import { describe, expect, it } from "vitest";
import {
  EDITORIAL_STORY_CATEGORY_LABELS,
  EDITORIAL_STORY_DEFAULT_CATEGORIES,
  type EditorialStoryCategory,
  defaultEditorialStoryCategory,
  editorialStoryTab,
} from "./editorial-story-category.js";

describe("editorial story categories", () => {
  it("maps every kind to a sensible default category", () => {
    expect(defaultEditorialStoryCategory("article")).toBe("article");
    expect(defaultEditorialStoryCategory("film")).toBe("film");
    expect(defaultEditorialStoryCategory("press")).toBe("press");
    expect(defaultEditorialStoryCategory("guide")).toBe("collecting_guide");
    expect(defaultEditorialStoryCategory("podcast")).toBe("podcast");
    expect(EDITORIAL_STORY_DEFAULT_CATEGORIES).toHaveLength(5);
  });

  it("groups categories into the three stories tabs", () => {
    const byTab = (Object.keys(EDITORIAL_STORY_CATEGORY_LABELS) as EditorialStoryCategory[]).reduce<
      Record<string, EditorialStoryCategory[]>
    >((groups, category) => {
      const tab = editorialStoryTab(category);
      groups[tab] = [...(groups[tab] ?? []), category];
      return groups;
    }, {});
    expect(byTab).toEqual({
      stories_and_films: [
        "article",
        "artist_interview",
        "artist_conversation",
        "studio_visit",
        "film",
        "collecting_guide",
        "exhibition",
      ],
      press: ["press"],
      podcast: ["podcast"],
    });
  });
});
