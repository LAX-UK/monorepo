import { describe, expect, it } from "vitest";
import { type PrintLabelRow, printLabelOf } from "./print-label.js";

const noRun = {
  runKind: null,
  runRole: null,
  runTemplate: null,
  runSize: null,
  allocBuyer: null,
  allocArtist: null,
  allocLax: null,
  openDefaultArtistPct: null,
  mainRunArtworkId: null,
  proofType: null,
  proofsKeptAp: null,
  proofsKeptPp: null,
  proofsKeptHc: null,
  proofsKeptBat: null,
};

const row = (overrides: Partial<PrintLabelRow>): PrintLabelRow => ({
  editionNumber: 7,
  stockRef: 7,
  proofNumber: null,
  artworkId: "artwork-1",
  sourceOriginalArtworkId: null,
  ...noRun,
  ...overrides,
});

describe("printLabelOf", () => {
  it("labels a numbered print with its number and the run's size", () => {
    expect(
      printLabelOf(
        row({
          runKind: "limited",
          runRole: "main",
          runTemplate: "lax_standard",
          runSize: 24,
          allocBuyer: 10,
          allocArtist: 10,
          allocLax: 4,
        }),
      ),
    ).toBe("7/24");
  });

  it("labels a print of a custom run by that run's size", () => {
    expect(
      printLabelOf(
        row({
          editionNumber: 31,
          stockRef: 31,
          runKind: "limited",
          runRole: "main",
          runTemplate: "custom",
          runSize: 40,
          allocBuyer: 0,
          allocArtist: 30,
          allocLax: 10,
        }),
      ),
    ).toBe("31/40");
  });

  it("labels an unnumbered open-edition print by its stock reference, never as a number", () => {
    expect(
      printLabelOf(
        row({
          editionNumber: null,
          stockRef: 21,
          runKind: "open",
          runRole: "main",
          openDefaultArtistPct: 50,
        }),
      ),
    ).toBe("OE-0021");
  });

  it("labels an artist's proof with its proof number", () => {
    expect(
      printLabelOf(
        row({
          editionNumber: null,
          stockRef: 2,
          proofNumber: 2,
          runKind: "limited",
          runRole: "proof",
          runSize: 3,
          allocBuyer: 0,
          allocArtist: 3,
          allocLax: 0,
          mainRunArtworkId: "main-1",
          proofType: "ap",
        }),
      ),
    ).toBe("AP 2/3");
  });

  it("treats a listing with no stored run as the LAX standard run", () => {
    expect(printLabelOf(row({}))).toBe("7/24");
  });
});
