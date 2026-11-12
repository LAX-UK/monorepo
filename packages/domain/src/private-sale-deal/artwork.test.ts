import { describe, expect, it } from "vitest";
import { canChangeArtwork, canLinkArtwork, planDealArtworkMove } from "./artwork.js";

const ART = "a1";
const OTHER = "a2";

describe("canLinkArtwork", () => {
  it.each([
    ["proposed", true],
    ["offer", true],
    ["agreed", true],
    ["cleared", true],
    ["invoiced", true],
    ["paid", true],
    ["released", true],
    ["settled", false],
    ["cancelled", false],
  ] as const)("at %s: %s", (stage, allowed) => {
    expect(canLinkArtwork(stage)).toBe(allowed);
  });
});

describe("canChangeArtwork", () => {
  it.each([
    ["proposed", true],
    ["offer", true],
    ["agreed", false],
    ["cleared", false],
    ["invoiced", false],
    ["paid", false],
    ["released", false],
    ["settled", false],
    ["cancelled", false],
  ] as const)("at %s: %s", (stage, allowed) => {
    expect(canChangeArtwork(stage)).toBe(allowed);
  });
});

describe("planDealArtworkMove", () => {
  const unlinked = { artworkRegisterId: null, artworkUnlinkedReason: null } as const;
  const held = { artworkRegisterId: ART, artworkUnlinkedReason: null } as const;

  it("links an artwork to a deal that has none, up to the end of the deal", () => {
    expect(
      planDealArtworkMove(
        { stage: "paid", ...unlinked },
        { kind: "register", artworkRegisterId: ART },
      ),
    ).toEqual({ ok: true, move: "link" });
    expect(
      planDealArtworkMove(
        { stage: "settled", ...unlinked },
        { kind: "register", artworkRegisterId: ART },
      ),
    ).toEqual({ ok: false, refusal: "stage_locked" });
  });

  it("records a reason while nothing is linked, and says when it is already recorded", () => {
    expect(
      planDealArtworkMove(
        { stage: "offer", ...unlinked },
        { kind: "not_in_register", reason: "sellers_own_work" },
      ),
    ).toEqual({ ok: true, move: "record_reason" });
    expect(
      planDealArtworkMove(
        { stage: "offer", artworkRegisterId: null, artworkUnlinkedReason: "sellers_own_work" },
        { kind: "not_in_register", reason: "sellers_own_work" },
      ),
    ).toEqual({ ok: false, refusal: "unchanged" });
  });

  describe("replacing a recorded reason", () => {
    const own = { artworkRegisterId: null, artworkUnlinkedReason: "sellers_own_work" } as const;
    const target = { kind: "not_in_register", reason: "in_zoho_not_linked" } as const;

    it.each(["proposed", "offer"] as const)("is a change, allowed while %s", (stage) => {
      expect(planDealArtworkMove({ stage, ...own }, target)).toEqual({
        ok: true,
        move: "replace_reason",
      });
    });

    it.each(["agreed", "cleared", "invoiced", "paid", "released", "settled", "cancelled"] as const)(
      "is refused once the deal is %s, so it can't undo or dodge the Agree check",
      (stage) => {
        expect(planDealArtworkMove({ stage, ...own }, target)).toEqual({
          ok: false,
          refusal: "stage_locked",
        });
        expect(
          planDealArtworkMove(
            { stage, artworkRegisterId: null, artworkUnlinkedReason: "in_zoho_not_linked" },
            { kind: "not_in_register", reason: "sellers_own_work" },
          ),
        ).toEqual({ ok: false, refusal: "stage_locked" });
      },
    );

    it("still links a register artwork until the deal settles, whatever reason was recorded", () => {
      for (const stage of ["agreed", "paid", "released"] as const) {
        expect(
          planDealArtworkMove({ stage, ...own }, { kind: "register", artworkRegisterId: ART }),
        ).toEqual({ ok: true, move: "link" });
      }
    });

    it("says the same reason is already recorded", () => {
      expect(
        planDealArtworkMove(
          { stage: "agreed", ...own },
          { kind: "not_in_register", reason: "sellers_own_work" },
        ),
      ).toEqual({ ok: false, refusal: "unchanged" });
    });
  });

  it("changes a held artwork only before the deal is agreed", () => {
    const target = { kind: "register", artworkRegisterId: OTHER } as const;
    expect(planDealArtworkMove({ stage: "proposed", ...held }, target)).toEqual({
      ok: true,
      move: "change",
    });
    expect(planDealArtworkMove({ stage: "agreed", ...held }, target)).toEqual({
      ok: false,
      refusal: "stage_locked",
    });
  });

  it("refuses to change an artwork to itself", () => {
    expect(
      planDealArtworkMove(
        { stage: "offer", ...held },
        { kind: "register", artworkRegisterId: ART },
      ),
    ).toEqual({ ok: false, refusal: "unchanged" });
  });

  it("removes a held artwork, with the reason that replaces it, only before agreement", () => {
    const target = { kind: "not_in_register", reason: "in_zoho_not_linked" } as const;
    expect(planDealArtworkMove({ stage: "offer", ...held }, target)).toEqual({
      ok: true,
      move: "remove",
    });
    expect(planDealArtworkMove({ stage: "paid", ...held }, target)).toEqual({
      ok: false,
      refusal: "stage_locked",
    });
  });
});
