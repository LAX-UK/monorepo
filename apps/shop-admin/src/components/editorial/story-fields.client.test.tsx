// @vitest-environment jsdom
import { StoryFields } from "@/components/editorial/story-fields.client";
import { type StoryForm, emptyStoryForm } from "@/lib/editorial-entity-forms";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function renderFields(overrides: Partial<StoryForm>) {
  render(
    <StoryFields
      form={{ ...emptyStoryForm(), ...overrides }}
      errors={{}}
      disabled={false}
      onChange={vi.fn()}
    />,
  );
}

const KIND_ONLY_LABELS = {
  series: "Series (optional)",
  episodeNumber: "Episode number (optional)",
  audioUrl: "Audio URL",
  duration: "Duration (optional)",
  readMinutes: "Reading time in minutes (optional)",
  publicationName: "Publication",
  externalUrl: "Link to the piece",
} as const;

function shown(): string[] {
  return Object.entries(KIND_ONLY_LABELS)
    .filter(([, label]) => screen.queryByLabelText(label) !== null)
    .map(([field]) => field);
}

describe("story fields by kind", () => {
  it("asks a podcast for its series, episode, audio and duration only", () => {
    renderFields({ kind: "podcast" });
    expect(shown()).toEqual(["series", "episodeNumber", "audioUrl", "duration"]);
    expect(screen.getByRole("heading", { name: "Podcast details" })).toBeInTheDocument();
  });

  it("asks a press story for the publication and link only", () => {
    renderFields({ kind: "press" });
    expect(shown()).toEqual(["publicationName", "externalUrl"]);
  });

  it("asks an article for its reading time only", () => {
    renderFields({ kind: "article" });
    expect(shown()).toEqual(["readMinutes"]);
  });

  it("asks a guide for reading time and series", () => {
    renderFields({ kind: "guide" });
    expect(shown()).toEqual(["series", "readMinutes"]);
  });

  it("asks a film for its duration only", () => {
    renderFields({ kind: "film" });
    expect(shown()).toEqual(["duration"]);
  });

  it("always shows the fields every kind shares", () => {
    renderFields({ kind: "press" });
    for (const label of [
      "Slug",
      "Title",
      "Category",
      "Author or host (optional)",
      "Video URL (optional)",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("shows a kind-specific error against its own field", () => {
    render(
      <StoryFields
        form={{ ...emptyStoryForm(), kind: "podcast" }}
        errors={{ audioUrl: "Audio URL must start with https://." }}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Audio URL")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Audio URL must start with https://.")).toBeInTheDocument();
  });
});
