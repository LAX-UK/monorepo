import type { AdminHomeCover } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  type HomeCoverDraft,
  draftDiffersFromSaved,
  draftFromSaved,
  draftIsMeasured,
  homeCoverDraftProblems,
  homeCoverIssueProblems,
  homeCoverPlacementLine,
  suggestedAlt,
} from "./home-cover";

const saved: NonNullable<AdminHomeCover["cover"]> = {
  mediaKey: "shop/artwork/a.jpg",
  imageUrl: "https://media.test/shop/artwork/a.jpg",
  width: 3200,
  height: 1600,
  alt: "A river at dusk",
  focal: { x: 0.7, y: 0.4 },
  side: "left",
  tone: "light",
  updatedAt: "2026-11-12T10:00:00.000Z",
};

const draft = (over: Partial<HomeCoverDraft> = {}): HomeCoverDraft => ({
  ...draftFromSaved(saved),
  ...over,
});

describe("draftDiffersFromSaved", () => {
  it("is false for the saved cover itself", () => {
    expect(draftDiffersFromSaved(draft(), saved)).toBe(false);
  });

  it("notices another picture, other words and another point", () => {
    expect(draftDiffersFromSaved(draft({ mediaKey: "b" }), saved)).toBe(true);
    expect(draftDiffersFromSaved(draft({ alt: "A weir" }), saved)).toBe(true);
    expect(draftDiffersFromSaved(draft({ focal: { x: 0.2, y: 0.4 } }), saved)).toBe(true);
  });

  it("ignores spaces around the alt text", () => {
    expect(draftDiffersFromSaved(draft({ alt: "  A river at dusk " }), saved)).toBe(false);
  });

  it("counts a first draft as a change, and nothing against nothing as none", () => {
    expect(draftDiffersFromSaved(draft(), null)).toBe(true);
    expect(draftDiffersFromSaved(null, null)).toBe(false);
    expect(draftDiffersFromSaved(null, saved)).toBe(true);
  });
});

describe("draftIsMeasured", () => {
  it("holds only while the draft is the saved cover", () => {
    expect(draftIsMeasured(draft(), saved)).toBe(true);
    expect(draftIsMeasured(draft({ focal: { x: 0.1, y: 0.4 } }), saved)).toBe(false);
    expect(draftIsMeasured(draft(), null)).toBe(false);
  });
});

describe("homeCoverDraftProblems", () => {
  it("accepts a picture at the floor with alt text", () => {
    expect(homeCoverDraftProblems(draft({ width: 2400 }), 2400)).toEqual([]);
  });

  it("names a picture known to be too narrow, with its width", () => {
    expect(homeCoverDraftProblems(draft({ width: 1800 }), 2400)).toEqual([
      {
        field: "mediaKey",
        message: "This picture is 1800 px wide. The cover needs at least 2400 px.",
      },
    ]);
  });

  it("leaves the size to the server when it is not known yet", () => {
    expect(homeCoverDraftProblems(draft({ width: null, height: null }), 2400)).toEqual([]);
  });

  it("asks for alt text, ignoring spaces, and limits its length", () => {
    expect(homeCoverDraftProblems(draft({ alt: "   " }), 2400)).toEqual([
      { field: "alt", message: "Describe the picture in a few words." },
    ]);
    expect(homeCoverDraftProblems(draft({ alt: "x".repeat(501) }), 2400)).toEqual([
      { field: "alt", message: "Keep the alt text to 500 characters." },
    ]);
  });
});

describe("homeCoverIssueProblems", () => {
  const context = { width: 1800, minimumWidth: 2400 };

  it("turns each issue shop-api names into the words staff read", () => {
    expect(
      homeCoverIssueProblems(
        [
          { field: "alt", reason: "alt_missing" },
          { field: "mediaKey", reason: "picture_too_narrow" },
          { field: "mediaKey", reason: "picture_cannot_carry_type" },
        ],
        context,
      ).map((problem) => problem.message),
    ).toEqual([
      "Describe the picture in a few words.",
      "This picture is 1800 px wide. The cover needs at least 2400 px.",
      "The headline can't be read on this picture. Choose one with a calmer area on the side the headline sits.",
    ]);
  });

  it("drops anything it does not recognise", () => {
    expect(
      homeCoverIssueProblems([{ field: "other", reason: "nope" }, "x", null], context),
    ).toEqual([]);
    expect(homeCoverIssueProblems(undefined, context)).toEqual([]);
  });
});

describe("copy helpers", () => {
  it("says where the headline sits and in which type", () => {
    expect(homeCoverPlacementLine({ side: "left", tone: "light" })).toBe(
      "The headline sits on the left, in white type.",
    );
    expect(homeCoverPlacementLine({ side: "right", tone: "dark" })).toBe(
      "The headline sits on the right, in dark type.",
    );
  });

  it("suggests alt text from the edition", () => {
    expect(suggestedAlt("Vessel Study", "Flora Powers")).toBe("Vessel Study, by Flora Powers");
  });
});
