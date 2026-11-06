import {
  type EditionFacts,
  type EditionRunSpec,
  LAX_STANDARD_RUN,
  describeEditionFacts,
} from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { type EditionRunsReader, type RunOfArtwork, basketEditions } from "./basket-edition.js";

const confirmed = { by: "staff", at: new Date("2026-10-28T09:00:00Z") };
const handSigned: EditionFacts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: { kind: "none" },
  confirmed,
};
const open: EditionRunSpec = { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } };
const proof: EditionRunSpec = {
  type: "proof",
  proofType: "ap",
  size: 3,
  owner: "artist",
  mainRunId: "main",
  proofsKeptOnMain: 3,
};

function readerOf(runs: RunOfArtwork[]): EditionRunsReader & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async runsOf(ids) {
      calls.push([...ids]);
      return runs.filter((run) => ids.includes(run.artworkId));
    },
  };
}

describe("basketEditions", () => {
  it("words a limited edition with its confirmed facts, from the shared contract", async () => {
    const editions = await basketEditions(
      readerOf([{ artworkId: "a1", run: LAX_STANDARD_RUN, facts: handSigned }]),
      ["a1"],
    );
    expect(editions.get("a1")).toEqual({
      size: 24,
      line: describeEditionFacts(LAX_STANDARD_RUN, handSigned).basketLine,
    });
    expect(editions.get("a1")?.line).toBe("Limited edition of 24 · Hand-signed · Numbered");
  });

  it("names only the run until staff have confirmed the facts", async () => {
    const unconfirmed = { ...handSigned, confirmed: null };
    const editions = await basketEditions(
      readerOf([
        { artworkId: "a1", run: LAX_STANDARD_RUN, facts: unconfirmed },
        { artworkId: "a2", run: LAX_STANDARD_RUN, facts: null },
      ]),
      ["a1", "a2"],
    );
    expect(editions.get("a1")).toEqual({ size: 24, line: "Limited edition of 24" });
    expect(editions.get("a2")).toEqual({ size: 24, line: "Limited edition of 24" });
  });

  it("gives an open edition no size, so its prints are never counted as a limited run", async () => {
    const editions = await basketEditions(readerOf([{ artworkId: "a3", run: open, facts: null }]), [
      "a3",
    ]);
    expect(editions.get("a3")).toEqual({ size: null, line: "Open edition" });
  });

  it("gives a proof no run size and names it as a proof", async () => {
    const editions = await basketEditions(
      readerOf([{ artworkId: "a4", run: proof, facts: null }]),
      ["a4"],
    );
    expect(editions.get("a4")).toEqual({ size: null, line: "Artist's proof, one of 3" });
  });

  it("reads each run once for the whole basket and leaves out an original", async () => {
    const reader = readerOf([{ artworkId: "a1", run: LAX_STANDARD_RUN, facts: null }]);
    const editions = await basketEditions(reader, ["a1", "a1", "original"]);
    expect(reader.calls).toEqual([["a1", "original"]]);
    expect([...editions.keys()]).toEqual(["a1"]);
  });

  it("does not read at all for an empty basket", async () => {
    const reader = readerOf([]);
    expect(await basketEditions(reader, [])).toEqual(new Map());
    expect(reader.calls).toEqual([]);
  });
});
