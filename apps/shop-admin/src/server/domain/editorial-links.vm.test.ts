import { describe, expect, it } from "vitest";
import {
  EXHIBITION_LINK_SECTIONS,
  type LinkRow,
  STORY_LINK_SECTIONS,
  adoptStoredLinks,
  anyLinkListDirty,
  editLinkList,
  initialLinksState,
  isLinkListDirty,
  linkListIds,
  linkSectionsFor,
  markLinkListSaved,
  publicRailNote,
  toLinkRow,
  unknownRecordsMessage,
} from "./editorial-links.vm";

const item = (id: string, title = id, published = true) => ({
  id,
  title,
  slug: `${id}-slug`,
  thumbnailUrl: null,
  published,
});
const row = (id: string, title = id): LinkRow => toLinkRow(item(id, title));

const [artworks, artists, stories] = EXHIBITION_LINK_SECTIONS;
const [, , exhibitions] = STORY_LINK_SECTIONS;
if (!artworks || !artists || !stories || !exhibitions) throw new Error("missing section specs");

const payload = {
  artworks: [item("a"), item("b"), item("c")],
  artists: [item("x")],
  stories: [item("s1")],
  version: "v1",
};

describe("toLinkRow", () => {
  it("shows the public address and flags records that are not live", () => {
    expect(toLinkRow(item("a", "Paper Rooms", false))).toMatchObject({
      title: "Paper Rooms",
      subtitle: "/a-slug",
      notPublic: true,
    });
    expect(toLinkRow(item("a")).notPublic).toBe(false);
  });
});

describe("link section specs", () => {
  it("orders artworks and artists but not the story and exhibition sets", () => {
    expect(linkSectionsFor("exhibitions").map((s) => [s.list, s.ordered])).toEqual([
      ["artworks", true],
      ["artists", true],
      ["stories", false],
    ]);
    expect(linkSectionsFor("stories").map((s) => [s.list, s.ordered])).toEqual([
      ["artists", true],
      ["artworks", true],
      ["exhibitions", false],
    ]);
  });
});

describe("dirty detection", () => {
  const specs = EXHIBITION_LINK_SECTIONS;
  const start = () => initialLinksState(payload, specs);

  it("starts clean", () => {
    expect(anyLinkListDirty(start(), specs)).toBe(false);
  });

  it("sees a reorder of an ordered list", () => {
    const state = editLinkList(start(), "artworks", [row("b"), row("a"), row("c")]);
    expect(isLinkListDirty(state, artworks)).toBe(true);
    expect(isLinkListDirty(state, artists)).toBe(false);
  });

  it("is clean again once the order is restored", () => {
    let state = editLinkList(start(), "artworks", [row("b"), row("a"), row("c")]);
    state = editLinkList(state, "artworks", [row("a"), row("b"), row("c")]);
    expect(isLinkListDirty(state, artworks)).toBe(false);
  });

  it("sees an addition and a removal", () => {
    expect(isLinkListDirty(editLinkList(start(), "artists", [row("x"), row("y")]), artists)).toBe(
      true,
    );
    expect(isLinkListDirty(editLinkList(start(), "artists", []), artists)).toBe(true);
  });

  it("ignores the order of an unordered set", () => {
    const base = initialLinksState({ ...payload, stories: [item("s1"), item("s2")] }, specs);
    expect(isLinkListDirty(editLinkList(base, "stories", [row("s2"), row("s1")]), stories)).toBe(
      false,
    );
    expect(isLinkListDirty(editLinkList(base, "stories", [row("s2"), row("s3")]), stories)).toBe(
      true,
    );
  });

  it("sends the ids in list order", () => {
    const state = editLinkList(start(), "artworks", [row("c"), row("a")]);
    expect(linkListIds(state, "artworks")).toEqual(["c", "a"]);
  });
});

describe("markLinkListSaved", () => {
  it("clears only the saved list and takes the new version", () => {
    let state = initialLinksState(payload, EXHIBITION_LINK_SECTIONS);
    state = editLinkList(state, "artworks", [row("c")]);
    state = editLinkList(state, "artists", []);
    state = markLinkListSaved(state, "artworks", "v2");

    expect(state.version).toBe("v2");
    expect(isLinkListDirty(state, artworks)).toBe(false);
    expect(isLinkListDirty(state, artists)).toBe(true);
  });
});

describe("adoptStoredLinks", () => {
  const specs = EXHIBITION_LINK_SECTIONS;
  const stored = { ...payload, artworks: [item("z")], version: "v9" };

  it("replaces the reloaded list and keeps edits to the others", () => {
    let state = initialLinksState(payload, specs);
    state = editLinkList(state, "artworks", [row("b")]);
    state = editLinkList(state, "artists", [row("x"), row("y")]);

    const next = adoptStoredLinks(state, stored, specs, "artworks");

    expect(next.version).toBe("v9");
    expect(linkListIds(next, "artworks")).toEqual(["z"]);
    expect(isLinkListDirty(next, artworks)).toBe(false);
    expect(linkListIds(next, "artists")).toEqual(["x", "y"]);
    expect(isLinkListDirty(next, artists)).toBe(true);
  });

  it("refreshes clean lists to the stored contents", () => {
    const next = adoptStoredLinks(initialLinksState(payload, specs), stored, specs, "artists");
    expect(linkListIds(next, "artworks")).toEqual(["z"]);
    expect(anyLinkListDirty(next, specs)).toBe(false);
  });
});

describe("publicRailNote", () => {
  it("stays quiet up to the limit and warns beyond it", () => {
    expect(publicRailNote(artworks, 24)).toBeNull();
    expect(publicRailNote(artworks, 25)).toBe("Only the first 24 appear on lax.art.");
    expect(publicRailNote(exhibitions, 25)).toBe("Only 24 of these appear on lax.art.");
  });
});

describe("unknownRecordsMessage", () => {
  it("names the rejected records", () => {
    const items = [row("a", "Paper Rooms"), row("b", "Tides")];
    expect(unknownRecordsMessage(artworks, ["a"], items)).toBe(
      "Could not save artworks: “Paper Rooms” does not exist any more. Remove it from the list and save again.",
    );
    expect(unknownRecordsMessage(artworks, ["a", "b"], items)).toContain(
      "“Paper Rooms”, “Tides” do not",
    );
  });

  it("counts ids it cannot name", () => {
    expect(unknownRecordsMessage(artworks, ["gone"], [row("a")])).toContain(
      "1 more that could not be named",
    );
  });
});
