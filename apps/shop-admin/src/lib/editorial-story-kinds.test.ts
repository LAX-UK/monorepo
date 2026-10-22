import { describe, expect, it } from "vitest";
import {
  STORY_KINDS,
  formatDuration,
  parseDuration,
  storyCategoryOptions,
  storyKindFields,
  storyKindHasField,
} from "./editorial-story-kinds";

describe("storyKindFields", () => {
  it("maps each kind to the details it uses", () => {
    expect(storyKindFields("podcast")).toEqual([
      "series",
      "episodeNumber",
      "audioUrl",
      "durationSeconds",
    ]);
    expect(storyKindFields("press")).toEqual(["publicationName", "externalUrl"]);
    expect(storyKindFields("article")).toEqual(["readMinutes"]);
    expect(storyKindFields("guide")).toEqual(["readMinutes", "series"]);
    expect(storyKindFields("film")).toEqual(["durationSeconds"]);
  });

  it("gives every kind at least one detail and never shares audio or press fields", () => {
    for (const kind of STORY_KINDS) expect(storyKindFields(kind).length).toBeGreaterThan(0);
    expect(STORY_KINDS.filter((kind) => storyKindHasField(kind, "audioUrl"))).toEqual(["podcast"]);
    expect(STORY_KINDS.filter((kind) => storyKindHasField(kind, "publicationName"))).toEqual([
      "press",
    ]);
  });
});

describe("storyCategoryOptions", () => {
  it("names the kind's default on the blank option", () => {
    expect(storyCategoryOptions("guide")[0]).toEqual({
      value: "",
      label: "Default for guide (Collecting guide)",
    });
    expect(storyCategoryOptions("press").map((option) => option.value)).toContain("studio_visit");
  });
});

describe("durations", () => {
  it("parses minutes and seconds, and hours", () => {
    expect(parseDuration("46:18")).toBe(2778);
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration(" 0:05 ")).toBe(5);
  });

  it.each(["", "46", "46:75", "abc", "1:2:3"])("rejects %j", (text) => {
    expect(parseDuration(text)).toBeNull();
  });

  it("formats seconds back the way they are typed", () => {
    expect(formatDuration(2778)).toBe("46:18");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(5)).toBe("0:05");
  });
});
