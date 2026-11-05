import type { EditionFacts, EditionRunSpec } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import {
  type EditionCardFactsReader,
  type RunWithFacts,
  editionCardLines,
} from "./edition-card-lines.js";

const confirmed = { by: "staff-1", at: new Date("2026-10-01T00:00:00Z") };
const handSigned: EditionFacts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: { kind: "none" },
  confirmed,
};
const plateSigned: EditionFacts = {
  numbering: "none",
  signature: { kind: "plate_signed" },
  certificate: { kind: "none" },
  confirmed,
};
const limited: EditionRunSpec = {
  type: "custom_limited",
  size: 25,
  allocation: { buyer: 0, artist: 0, lax: 25 },
  linkedToOriginal: false,
};
const open: EditionRunSpec = { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } };
const proof: EditionRunSpec = {
  type: "proof",
  proofType: "ap",
  size: 2,
  owner: "artist",
  mainRunId: "main",
  proofsKeptOnMain: 2,
};

function fake(rows: RunWithFacts[]) {
  const runsWithFacts = vi.fn(async (ids: readonly string[]) =>
    rows.filter((row) => ids.includes(row.artworkId)),
  );
  return { reader: { runsWithFacts } satisfies EditionCardFactsReader, runsWithFacts };
}

describe("editionCardLines", () => {
  it("writes the shop-domain card line for limited, open and proof runs", async () => {
    const { reader } = fake([
      { artworkId: "a", run: limited, facts: handSigned },
      { artworkId: "b", run: open, facts: plateSigned },
      { artworkId: "c", run: proof, facts: handSigned },
    ]);
    const lines = await editionCardLines(reader, ["a", "b", "c"]);
    expect(lines.get("a")).toBe("Limited edition of 25 · Hand-signed");
    expect(lines.get("b")).toBe("Open edition · Plate-signed");
    expect(lines.get("c")).toBe("Artist's proof · Hand-signed");
  });

  it("reads once for the whole page, without duplicate ids", async () => {
    const { reader, runsWithFacts } = fake([{ artworkId: "a", run: limited, facts: handSigned }]);
    await editionCardLines(reader, ["a", "b", "a", "c"]);
    expect(runsWithFacts).toHaveBeenCalledTimes(1);
    expect(runsWithFacts).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("leaves out originals and runs with no stored facts", async () => {
    const { reader } = fake([{ artworkId: "a", run: limited, facts: handSigned }]);
    const lines = await editionCardLines(reader, ["a", "original", "no-facts"]);
    expect([...lines.keys()]).toEqual(["a"]);
  });

  it("leaves out facts that are not confirmed yet", async () => {
    const { reader } = fake([
      { artworkId: "a", run: limited, facts: { ...handSigned, confirmed: null } },
    ]);
    expect((await editionCardLines(reader, ["a"])).size).toBe(0);
  });

  it("does not read at all for an empty page", async () => {
    const { reader, runsWithFacts } = fake([]);
    expect((await editionCardLines(reader, [])).size).toBe(0);
    expect(runsWithFacts).not.toHaveBeenCalled();
  });

  it("never puts a count of prints left in a line", async () => {
    const { reader } = fake([{ artworkId: "a", run: limited, facts: handSigned }]);
    expect((await editionCardLines(reader, ["a"])).get("a")).not.toMatch(
      /left|remaining|available/i,
    );
  });
});
