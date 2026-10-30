import type { AdminArtistApplicationEvent } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  ARTIST_SLUG_PATTERN,
  applicationTitle,
  artistApplicationsList,
  historyEvents,
  parseArtistApplicationsState,
  staffActionsFor,
  suggestArtistSlug,
  workCaption,
  workGalleryItems,
} from "./artist-application.vm";

describe("artist applications queue", () => {
  it("opens on new applications, newest first", () => {
    const state = parseArtistApplicationsState({});
    expect(state.view).toBe("new");
    expect(artistApplicationsList.apiQuery(state)).toMatchObject({ view: "new" });
  });

  it("takes a colleague as the reviewer filter", () => {
    expect(parseArtistApplicationsState({ assignee: "staff-subject-9" }).filters.assignee).toBe(
      "staff-subject-9",
    );
  });

  it("names a row by the artist, else by its reference", () => {
    expect(applicationTitle({ artistName: " Ada Moreno ", reference: "LAX-AP-1" })).toBe(
      "Ada Moreno",
    );
    expect(applicationTitle({ artistName: null, reference: "LAX-AP-1" })).toBe("LAX-AP-1");
  });
});

describe("staff actions", () => {
  it("follows the transition table", () => {
    expect([...staffActionsFor("in_review")]).toEqual([
      "assign",
      "request_info",
      "accept",
      "decline",
    ]);
    expect([...staffActionsFor("more_info_needed")]).toEqual(["assign", "decline"]);
    expect([...staffActionsFor("accepted")]).toEqual([]);
  });
});

describe("profile address", () => {
  it.each([
    ["Ada Moreno", "ada-moreno"],
    ["Zoë  Ångström-Lee", "zoe-angstrom-lee"],
    ["  ---  ", ""],
    [null, ""],
  ])("suggests %s as %s", (name, slug) => {
    expect(suggestArtistSlug(name)).toBe(slug);
  });

  it("accepts only lower-case words joined by single hyphens", () => {
    expect(ARTIST_SLUG_PATTERN.test("ada-moreno")).toBe(true);
    expect(ARTIST_SLUG_PATTERN.test("Ada")).toBe(false);
    expect(ARTIST_SLUG_PATTERN.test("ada--moreno")).toBe(false);
  });
});

describe("works", () => {
  it("captions a work with the facts it has", () => {
    expect(workCaption({ year: 2024, medium: "Oil on linen", size: "60 × 80 cm" })).toBe(
      "2024 · Oil on linen · 60 × 80 cm",
    );
    expect(workCaption({ year: null, medium: null, size: "A3" })).toBe("A3");
  });

  it("gives an untitled work a name and marks editions", () => {
    const [item] = workGalleryItems(
      [
        {
          mediaKey: "k",
          imageUrl: "/k.jpg",
          width: 10,
          height: 10,
          title: null,
          year: null,
          medium: null,
          size: null,
          kind: "edition",
        },
      ],
      (url) => (url ? `https://img.example${url}` : null),
    );
    expect(item).toMatchObject({
      title: "Untitled work 1",
      badge: "Edition",
      src: "https://img.example/k.jpg",
    });
    expect(item).not.toHaveProperty("caption");
  });
});

describe("history", () => {
  const event = (over: Partial<AdminArtistApplicationEvent>): AdminArtistApplicationEvent => ({
    id: "e",
    action: "submit",
    actor: { kind: "applicant", person: null },
    message: null,
    assignee: null,
    createdAt: "2026-10-28T10:00:00.000Z",
    ...over,
  });

  it("tells the story newest first, naming who acted", () => {
    const events = historyEvents({
      artistName: "Ada Moreno",
      events: [
        event({ id: "1" }),
        event({
          id: "2",
          action: "request_info",
          actor: {
            kind: "staff",
            person: { subject: "s", label: "Sam Reed", role: "catalogue_editor" },
          },
          message: "Frame sizes?",
        }),
      ],
    });
    expect(events.map((one) => [one.title, one.actor])).toEqual([
      ["Asked the artist for more information", "Sam Reed"],
      ["Application sent", "Ada Moreno"],
    ]);
    expect(events[0]).toMatchObject({ detail: "Frame sizes?", tone: "warning" });
  });
});
