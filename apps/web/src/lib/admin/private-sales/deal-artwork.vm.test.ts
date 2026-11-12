import { dealRecord } from "@/components/admin/private-sales/deal.fixture";
import { describe, expect, it } from "vitest";
import { artworkMoveTitle, artworkSectionLine } from "./deal-artwork.vm";

const linked = dealRecord();
const artwork = linked.artwork as NonNullable<typeof linked.artwork>;

describe("artworkSectionLine", () => {
  it.each([
    [
      "proposed",
      "Nothing else can offer it while the deal is open. Cancelling the deal releases it.",
    ],
    ["offer", "Nothing else can offer it while the deal is open. Cancelling the deal releases it."],
    [
      "agreed",
      "Locked to this deal from Agreed. To use another artwork, cancel this deal and open a new one.",
    ],
    [
      "invoiced",
      "Locked to this deal from Agreed. To use another artwork, cancel this deal and open a new one.",
    ],
    ["paid", "Paid. The register marks it sold when the deal settles."],
    ["released", "Paid. The register marks it sold when the deal settles."],
  ] as const)("at %s a held artwork says: %s", (stage, note) => {
    const line = artworkSectionLine(dealRecord({ stage }));
    expect(line.lead).toBe("Held for this deal");
    expect(line.trail).toBe(" since Sun 1 Nov, 09:00 GMT");
    expect(line.note).toBe(note);
  });

  it("does not claim a sale when the register shows the artwork somewhere else", () => {
    const line = artworkSectionLine(
      dealRecord({
        artwork: {
          ...artwork,
          whereItIs: {
            key: "lax_art",
            chip: { label: "On lax.art", tone: "success", marker: "filled" },
          },
        },
      }),
    );
    expect(line.lead).toBe("On lax.art");
    expect(line.note).toBe("The register shows this artwork somewhere other than this deal.");
  });

  it("says a settled deal's artwork is not marked sold yet while the register still holds it", () => {
    const line = artworkSectionLine(dealRecord({ stage: "settled" }));
    expect(line.lead).toBe("Not marked sold yet");
  });

  it("describes the two reasons for no register artwork", () => {
    const base = { artwork: null } as const;
    expect(
      artworkSectionLine(dealRecord({ ...base, artworkUnlinkedReason: "sellers_own_work" })).lead,
    ).toBe("The seller's own work");
    for (const reason of ["in_zoho_not_linked", null] as const) {
      const line = artworkSectionLine(dealRecord({ ...base, artworkUnlinkedReason: reason }));
      expect(line.lead).toBe("Not linked to the register");
      expect(line.chip.label).toBe("Not linked");
    }
  });
});

describe("artworkMoveTitle", () => {
  const move = (over: object) => ({
    action: "linked" as const,
    from: null,
    to: { title: "Evening Tide", stockCode: "C1" },
    fromUnlinkedReason: null,
    toUnlinkedReason: null,
    reason: null,
    createdAt: "2026-11-05T10:00:00.000Z",
    actorName: "Sara Osei",
    ...over,
  });

  it("words each move the way the deal's history reads", () => {
    expect(artworkMoveTitle(move({}))).toBe("Artwork held for this deal");
    expect(
      artworkMoveTitle(
        move({ action: "changed", from: { title: "Morning Tide", stockCode: "C0" } }),
      ),
    ).toBe("Artwork changed from Morning Tide to Evening Tide");
    expect(artworkMoveTitle(move({ action: "removed", to: null }))).toBe("Artwork removed");
    expect(artworkMoveTitle(move({ to: null, toUnlinkedReason: "sellers_own_work" }))).toBe(
      "Artwork: recorded as not in the register",
    );
  });
});
