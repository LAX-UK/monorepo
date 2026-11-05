import { describe, expect, it } from "vitest";
import {
  type PublicEditionFacts,
  describeOtherRun,
  describePublicEdition,
  publicEditionRun,
} from "./public-edition.js";

const handSigned: PublicEditionFacts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
};
const unsignedOpen: PublicEditionFacts = {
  numbering: "none",
  signature: { kind: "unsigned" },
  certificate: { kind: "none" },
};

describe("describePublicEdition", () => {
  it("words a limited run from the shared contract", () => {
    const d = describePublicEdition({
      run: { kind: "limited", size: 24 },
      facts: handSigned,
      proofsKept: { ap: 2, pp: 0, hc: 0 },
    });
    expect(d.eyebrow).toBe("Limited edition print");
    expect(d.rows?.edition).toBe("Limited edition of 24");
    expect(d.rows?.number).toBe(
      "Numbered by hand on the print. Your number appears in your order once payment is confirmed.",
    );
    expect(d.rows?.proofs).toBe(
      "The artist also kept 2 artist's proofs, outside the edition of 24.",
    );
    expect(d.statement).toBe(
      "A limited edition is a fixed number of prints from one image. No more will be made in this size and form.",
    );
  });

  it("has no proofs row when none were kept", () => {
    const d = describePublicEdition({
      run: { kind: "limited", size: 24 },
      facts: handSigned,
      proofsKept: { ap: 0, pp: 0, hc: 0 },
    });
    expect(d.rows?.proofs).toBeNull();
  });

  it("words an open run and a proof", () => {
    const open = describePublicEdition({ run: { kind: "open" }, facts: unsignedOpen });
    expect(open.eyebrow).toBe("Open edition print");
    expect(open.rows?.number).toBe("Not numbered");
    expect(open.statement).toBeNull();
    const proof = describePublicEdition({
      run: { kind: "proof", proofType: "ap", size: 3 },
      facts: handSigned,
    });
    expect(proof.eyebrow).toBe("Artist's proof");
    expect(proof.statement).toBeNull();
  });

  it("names the run alone while facts are unconfirmed", () => {
    const d = describePublicEdition({ run: { kind: "limited", size: 24 }, facts: null });
    expect(d.rows).toBeNull();
    expect(d.edition).toBe("Limited edition of 24");
  });
});

describe("describeOtherRun", () => {
  it("names proofs and open runs", () => {
    expect(describeOtherRun({ kind: "proof", proofType: "ap", size: 3 }, handSigned)).toBe(
      "As an artist's proof",
    );
    expect(describeOtherRun({ kind: "open" }, unsignedOpen)).toBe("Unsigned, open edition");
  });
});

describe("publicEditionRun", () => {
  it("keeps only kind and size", () => {
    expect(publicEditionRun({ type: "lax_standard" })).toEqual({ kind: "limited", size: 24 });
    expect(publicEditionRun({ type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } })).toEqual(
      { kind: "open" },
    );
    expect(
      publicEditionRun({
        type: "companion",
        mainRunId: "m",
        run: { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } },
      }),
    ).toEqual({ kind: "open" });
  });
});
