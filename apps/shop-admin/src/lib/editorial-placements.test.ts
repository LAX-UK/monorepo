import { describe, expect, it } from "vitest";
import {
  type AdminPlacementRow,
  PLACEMENT_MAX_ROWS,
  buildPlacementSlotPayload,
  emptyPlacementDraft,
  placementDraftsBySlot,
} from "./editorial-placements";

const STORY_ID = "8a1c7e2f-0b3d-4c5e-9f6a-7b8c9d0e1f2a";

function row(overrides: Partial<AdminPlacementRow>): AdminPlacementRow {
  return {
    id: crypto.randomUUID(),
    slot: "home_hero",
    position: 0,
    refKind: "story",
    refId: STORY_ID,
    headline: null,
    mediaKey: null,
    linkUrl: null,
    publishedAt: null,
    ...overrides,
  };
}

describe("placementDraftsBySlot", () => {
  it("groups rows by slot in position order and skips unknown slots", () => {
    let n = 0;
    const grouped = placementDraftsBySlot(
      [
        row({ position: 1, headline: "second" }),
        row({ position: 0, headline: "first" }),
        row({ slot: "legacy_slot" }),
        row({ slot: "home_guide", refKind: "external", refId: null, linkUrl: "/visit" }),
      ],
      () => `k${++n}`,
    );
    expect(grouped.home_hero.map((draft) => draft.headline)).toEqual(["first", "second"]);
    expect(grouped.home_guide).toEqual([
      {
        key: expect.any(String),
        refKind: "external",
        refId: "",
        headline: "",
        mediaKey: null,
        linkUrl: "/visit",
      },
    ]);
    expect(grouped.home_stories).toEqual([]);
  });
});

describe("buildPlacementSlotPayload", () => {
  it("assigns positions from row order and nulls blank optional fields", () => {
    const result = buildPlacementSlotPayload([
      { ...emptyPlacementDraft("a"), refKind: "story", refId: STORY_ID, headline: " Read " },
      { ...emptyPlacementDraft("b"), refKind: "external", refId: STORY_ID, linkUrl: "https://x.y" },
    ]);
    expect(result).toEqual({
      ok: true,
      payload: {
        items: [
          {
            position: 0,
            refKind: "story",
            refId: STORY_ID,
            headline: "Read",
            mediaKey: null,
            linkUrl: null,
          },
          {
            position: 1,
            refKind: "external",
            refId: null,
            headline: null,
            mediaKey: null,
            linkUrl: "https://x.y",
          },
        ],
      },
    });
  });

  it("requires a reference or a valid link", () => {
    const result = buildPlacementSlotPayload([
      emptyPlacementDraft("a"),
      { ...emptyPlacementDraft("b"), refKind: "external" },
      { ...emptyPlacementDraft("c"), refKind: "page", refId: STORY_ID, linkUrl: "//evil" },
    ]);
    expect(result).toEqual({
      ok: false,
      issues: [
        { rowKey: "a", field: "refId", message: "Choose which exhibition to feature." },
        { rowKey: "b", field: "linkUrl", message: "Enter the link URL." },
        {
          rowKey: "c",
          field: "linkUrl",
          message: "The link must start with https://, mailto: or a single /.",
        },
      ],
    });
  });

  it("accepts an empty slot and caps the row count", () => {
    expect(buildPlacementSlotPayload([])).toEqual({ ok: true, payload: { items: [] } });
    const tooMany = Array.from({ length: PLACEMENT_MAX_ROWS + 1 }, (_, i) => ({
      ...emptyPlacementDraft(String(i)),
      refKind: "external" as const,
      linkUrl: "/x",
    }));
    expect(buildPlacementSlotPayload(tooMany)).toMatchObject({
      ok: false,
      issues: [{ rowKey: null, field: null }],
    });
  });
});
